import logging
from typing import Optional
from pymongo import MongoClient
from pymongo.database import Database
from app.config import settings

logger = logging.getLogger("inventory_system.db")


class MongoDBManager:
    """
    Singleton connection manager for MongoDB.
    Maintains a reusable connection pool across all requests to adhere to performance
    and connection limit best practices.
    """
    _instance: Optional["MongoDBManager"] = None
    _client: Optional[MongoClient] = None
    _db: Optional[Database] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBManager, cls).__new__(cls)
        return cls._instance

    def connect(self) -> Database:
        if self._client is None:
            logger.info("Initializing MongoDB client connection pool...")
            try:
                self._client = MongoClient(
                    settings.mongodb_uri,
                    maxPoolSize=50,
                    minPoolSize=5,
                    maxIdleTimeMS=30000,
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=5000,
                    socketTimeoutMS=10000,
                    appname="IntelligentInventoryFastAPI"
                )
                self._db = self._client[settings.mongodb_database]
                # Test connection
                self._client.admin.command("ping")
                logger.info(f"Connected to MongoDB database: {settings.mongodb_database}")
            except Exception as e:
                logger.error(f"Failed to connect to MongoDB: {e}")
                # We do not crash here to allow fallback/mock modes or graceful error messages
                raise e
        return self._db

    def get_database(self) -> Database:
        if self._db is None:
            return self.connect()
        return self._db

    def get_client(self) -> MongoClient:
        if self._client is None:
            self.connect()
        return self._client

    def close(self):
        if self._client is not None:
            logger.info("Closing MongoDB connection pool...")
            self._client.close()
            self._client = None
            self._db = None
            logger.info("MongoDB connection pool closed.")

    def ping(self) -> bool:
        if self._client is None:
            return False
        try:
            self._client.admin.command("ping")
            return True
        except Exception:
            return False


db_manager = MongoDBManager()


def get_db() -> Database:
    """Dependency to retrieve database instance."""
    return db_manager.get_database()
