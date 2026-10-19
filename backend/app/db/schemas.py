"""
MongoDB Collection JSON Schema Validation
Implements database-level schema validation using collMod / createCollection with $jsonSchema.
"""

import logging
from pymongo.database import Database
from pymongo.errors import OperationFailure

logger = logging.getLogger("inventory_system.db.schemas")

COLLECTION_VALIDATORS = {
    "products": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["sku", "name", "category", "unit_price", "current_stock", "reorder_threshold"],
            "properties": {
                "sku": {
                    "bsonType": "string",
                    "pattern": "^[A-Z0-9_-]{3,20}$",
                    "description": "Unique Stock Keeping Unit: 3-20 uppercase alphanumeric or hyphen/underscore characters"
                },
                "name": {
                    "bsonType": "string",
                    "minLength": 2,
                    "maxLength": 100,
                    "description": "Product display name"
                },
                "category": {
                    "bsonType": "string",
                    "minLength": 2,
                    "maxLength": 50,
                    "description": "Product classification category"
                },
                "unit_price": {
                    "bsonType": ["double", "int", "decimal"],
                    "minimum": 0,
                    "description": "Selling price per unit (non-negative)"
                },
                "cost_price": {
                    "bsonType": ["double", "int", "decimal"],
                    "minimum": 0,
                    "description": "Acquisition cost per unit"
                },
                "current_stock": {
                    "bsonType": "int",
                    "minimum": 0,
                    "description": "On-hand inventory count (must be non-negative integer)"
                },
                "reorder_threshold": {
                    "bsonType": "int",
                    "minimum": 0,
                    "description": "Inventory level that triggers reorder alert"
                },
                "safety_stock": {
                    "bsonType": "int",
                    "minimum": 0,
                    "description": "Buffer stock to absorb demand uncertainty"
                },
                "supplier_id": {
                    "bsonType": ["string", "objectId", "null"],
                    "description": "Referenced supplier ID"
                },
                "created_at": {
                    "bsonType": "date"
                },
                "updated_at": {
                    "bsonType": "date"
                }
            }
        }
    },
    "sales": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["product_id", "sku", "quantity", "unit_price", "total_amount", "sale_date"],
            "properties": {
                "product_id": {
                    "bsonType": ["string", "objectId"],
                    "description": "Referenced product ID"
                },
                "sku": {
                    "bsonType": "string",
                    "description": "Product SKU at time of sale"
                },
                "quantity": {
                    "bsonType": "int",
                    "minimum": 1,
                    "description": "Quantity sold must be at least 1 unit"
                },
                "unit_price": {
                    "bsonType": ["double", "int", "decimal"],
                    "minimum": 0,
                    "description": "Price per unit at transaction time"
                },
                "total_amount": {
                    "bsonType": ["double", "int", "decimal"],
                    "minimum": 0,
                    "description": "Gross sale amount (quantity * unit_price)"
                },
                "sale_date": {
                    "bsonType": "date",
                    "description": "Exact timestamp of sale"
                },
                "idempotency_key": {
                    "bsonType": "string",
                    "description": "Unique client token to prevent duplicate transaction processing"
                }
            }
        }
    },
    "suppliers": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["supplier_code", "name", "lead_time_days"],
            "properties": {
                "supplier_code": {
                    "bsonType": "string",
                    "pattern": "^SUP-[A-Z0-9]{3,10}$",
                    "description": "Identifier like SUP-001"
                },
                "name": {
                    "bsonType": "string",
                    "minLength": 2,
                    "maxLength": 100
                },
                "contact_email": {
                    "bsonType": "string",
                    "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
                    "description": "Valid contact email address"
                },
                "phone": {
                    "bsonType": "string"
                },
                "lead_time_days": {
                    "bsonType": "int",
                    "minimum": 1,
                    "maximum": 120,
                    "description": "Average transit and fulfillment lead time in days"
                },
                "lead_time_variance_days": {
                    "bsonType": ["double", "int"],
                    "minimum": 0,
                    "description": "Standard deviation of lead time in days"
                },
                "active": {
                    "bsonType": "bool"
                }
            }
        }
    },
    "purchase_orders": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["po_number", "supplier_id", "status", "items", "total_cost", "created_at"],
            "properties": {
                "po_number": {
                    "bsonType": "string",
                    "pattern": "^PO-[0-9]{4}-[0-9]{4,}$",
                    "description": "Unique purchase order number"
                },
                "supplier_id": {
                    "bsonType": ["string", "objectId"]
                },
                "status": {
                    "enum": ["PENDING", "ORDERED", "RECEIVED", "CANCELLED"],
                    "description": "Lifecycle state of the purchase order"
                },
                "items": {
                    "bsonType": "array",
                    "minItems": 1,
                    "items": {
                        "bsonType": "object",
                        "required": ["product_id", "sku", "product_name", "quantity", "unit_cost"],
                        "properties": {
                            "product_id": {"bsonType": ["string", "objectId"]},
                            "sku": {"bsonType": "string"},
                            "product_name": {"bsonType": "string"},
                            "quantity": {"bsonType": "int", "minimum": 1},
                            "unit_cost": {"bsonType": ["double", "int", "decimal"], "minimum": 0},
                            "received_quantity": {"bsonType": "int", "minimum": 0}
                        }
                    }
                },
                "total_cost": {
                    "bsonType": ["double", "int", "decimal"],
                    "minimum": 0
                },
                "created_at": {"bsonType": "date"},
                "expected_delivery_date": {"bsonType": "date"},
                "received_at": {"bsonType": ["date", "null"]}
            }
        }
    },
    "forecasts": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["product_id", "sku", "model_version", "forecast_horizon_days", "generated_at", "predictions"],
            "properties": {
                "product_id": {"bsonType": ["string", "objectId"]},
                "sku": {"bsonType": "string"},
                "model_name": {"bsonType": "string"},
                "model_version": {"bsonType": "string"},
                "forecast_horizon_days": {"bsonType": "int", "minimum": 1},
                "generated_at": {"bsonType": "date"},
                "evaluation_metrics": {
                    "bsonType": "object",
                    "properties": {
                        "mae": {"bsonType": ["double", "int"]},
                        "rmse": {"bsonType": ["double", "int"]},
                        "mape": {"bsonType": ["double", "int"]}
                    }
                },
                "is_fallback": {"bsonType": "bool"},
                "fallback_reason": {"bsonType": ["string", "null"]},
                "predictions": {
                    "bsonType": "array",
                    "items": {
                        "bsonType": "object",
                        "required": ["date", "predicted_demand"],
                        "properties": {
                            "date": {"bsonType": "string"},
                            "predicted_demand": {"bsonType": ["double", "int"], "minimum": 0},
                            "lower_bound": {"bsonType": ["double", "int"]},
                            "upper_bound": {"bsonType": ["double", "int"]}
                        }
                    }
                }
            }
        }
    }
}


def apply_json_schema_validators(db: Database):
    """
    Applies JSON Schema validation rules to all primary collections in MongoDB.
    Uses collMod for existing collections, or creates collection with validator if new.
    """
    existing_collections = db.list_collection_names()
    for col_name, validator in COLLECTION_VALIDATORS.items():
        try:
            if col_name in existing_collections:
                db.command({
                    "collMod": col_name,
                    "validator": validator,
                    "validationLevel": "moderate",
                    "validationAction": "error"
                })
                logger.info(f"Updated JSON Schema validator on collection: {col_name}")
            else:
                db.create_collection(
                    col_name,
                    validator=validator,
                    validationLevel="moderate",
                    validationAction="error"
                )
                logger.info(f"Created collection with JSON Schema validator: {col_name}")
        except OperationFailure as e:
            # Some cloud clusters or limited roles may restrict collMod; log warning and continue
            logger.warning(f"Could not apply JSON schema validator on {col_name}: {e.details.get('errmsg', str(e))}")
