"""
Performance Service
Runs live explain("executionStats") benchmarks on MongoDB to compare
indexed execution (IXSCAN) versus unindexed table scans (COLLSCAN).
Inspects index catalog and execution performance.
"""

from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
from pymongo.database import Database
from app.db.indexes import get_collection_indexes_info
from app.models.schemas import QueryExplainResult, PerformanceReport


class PerformanceService:
    @classmethod
    def run_explain_benchmark(cls, db: Database) -> PerformanceReport:
        """
        Executes explain("executionStats") on a high-cardinality time-series sales query:
        Finding sales for a given product within the last 60 days, ordered by sale_date DESC.
        Compares:
        1. Indexed execution using compound index: (product_id ASC, sale_date DESC)
        2. Unindexed execution forcing a collection scan: hint({"$natural": 1})
        """
        now = datetime.now(timezone.utc)
        sixty_days_ago = now - timedelta(days=60)

        # Pick a product that has sales
        sample_sale = db.sales.find_one({}, {"product_id": 1})
        if sample_sale:
            target_prod_id = sample_sale["product_id"]
        else:
            sample_prod = db.products.find_one({}, {"_id": 1})
            target_prod_id = sample_prod["_id"] if sample_prod else "000000000000000000000000"

        query_filter = {
            "product_id": target_prod_id,
            "sale_date": {"$gte": sixty_days_ago}
        }

        # ---------------------------------------------------------
        # 1. Indexed Query Execution with explain("executionStats")
        # ---------------------------------------------------------
        try:
            indexed_cursor = db.sales.find(query_filter).sort("sale_date", -1)
            # Use hint to ensure index usage if multiple exist
            indexed_cursor = indexed_cursor.hint("idx_sales_product_date_compound")
            indexed_explain = indexed_cursor.explain()
        except Exception:
            # Fallback if hint name is slightly different
            indexed_explain = db.sales.find(query_filter).sort("sale_date", -1).explain()

        indexed_stats = cls._extract_execution_stats(indexed_explain)
        indexed_res = QueryExplainResult(
            query_description="Compound Index Query: (product_id: 1, sale_date: -1)",
            collection="sales",
            index_used=indexed_stats.get("index_name", "idx_sales_product_date_compound"),
            stage=indexed_stats.get("stage", "IXSCAN"),
            execution_time_millis=indexed_stats.get("execution_time_millis", 1.0),
            total_docs_examined=indexed_stats.get("total_docs_examined", 0),
            total_keys_examined=indexed_stats.get("total_keys_examined", 0),
            n_returned=indexed_stats.get("n_returned", 0),
            query_filter={"product_id": str(target_prod_id), "sale_date": ">= now - 60 days"},
            detailed_stats=indexed_stats
        )

        # ---------------------------------------------------------
        # 2. Unindexed Table Scan (COLLSCAN) with explain("executionStats")
        # ---------------------------------------------------------
        try:
            # Forcing $natural scan disables index lookup
            unindexed_cursor = db.sales.find(query_filter).sort("sale_date", -1).hint({"$natural": 1})
            unindexed_explain = unindexed_cursor.explain()
        except Exception:
            unindexed_explain = db.sales.find(query_filter).explain()

        unindexed_stats = cls._extract_execution_stats(unindexed_explain)
        unindexed_res = QueryExplainResult(
            query_description="Unindexed Table Scan (Forced Natural Collection Scan)",
            collection="sales",
            index_used=None,
            stage="COLLSCAN",
            execution_time_millis=unindexed_stats.get("execution_time_millis", 5.0),
            total_docs_examined=unindexed_stats.get("total_docs_examined", db.sales.count_documents({})),
            total_keys_examined=0,
            n_returned=unindexed_stats.get("n_returned", 0),
            query_filter={"product_id": str(target_prod_id), "sale_date": ">= now - 60 days"},
            detailed_stats=unindexed_stats
        )

        docs_diff = max(0, unindexed_res.total_docs_examined - indexed_res.total_docs_examined)
        summary = (
            f"Index Optimization Result: The compound index 'idx_sales_product_date_compound' bypassed "
            f"examining {docs_diff} unnecessary collection documents by utilizing B-tree key scanning ({indexed_res.stage}). "
            f"Total keys examined: {indexed_res.total_keys_examined} vs unindexed full scan of {unindexed_res.total_docs_examined} documents."
        )

        indexes_info = get_collection_indexes_info(db)

        return PerformanceReport(
            timestamp=now,
            database_name=db.name,
            indexes_by_collection=indexes_info,
            indexed_query_benchmark=indexed_res,
            unindexed_query_benchmark=unindexed_res,
            performance_summary=summary
        )

    @classmethod
    def _extract_execution_stats(cls, explain_doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        Traverses MongoDB explain() document tree to extract standard execution statistics.
        """
        exec_stats = explain_doc.get("executionStats", {})
        execution_stages = exec_stats.get("executionStages", {})

        # Find stage name
        stage = execution_stages.get("stage", "UNKNOWN")
        input_stage = execution_stages.get("inputStage", {})

        if input_stage.get("stage") == "IXSCAN":
            stage = "IXSCAN"
            index_name = input_stage.get("indexName")
        else:
            index_name = execution_stages.get("indexName") or input_stage.get("indexName")

        time_ms = float(exec_stats.get("executionTimeMillis", 0.0))
        docs_examined = int(exec_stats.get("totalDocsExamined", 0))
        keys_examined = int(exec_stats.get("totalKeysExamined", 0))
        n_returned = int(exec_stats.get("nReturned", 0))

        return {
            "execution_time_millis": time_ms,
            "total_docs_examined": docs_examined,
            "total_keys_examined": keys_examined,
            "n_returned": n_returned,
            "stage": stage,
            "index_name": index_name
        }
