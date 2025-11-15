"""
Script to seed the database with the default campaign
Run this after initializing the database
"""
import sys
sys.path.append('.')

from app.db import SessionLocal, init_db
from app.seed import seed_campaign


def main():
    print("Initializing database...")
    init_db()

    print("Creating database session...")
    db = SessionLocal()

    try:
        print("Seeding campaign data...")
        seed_campaign(db)
        print("\n✓ Database seeded successfully!")
        print("\nYou can now start the server with: uvicorn app.main:app --reload")

    except Exception as e:
        print(f"\n✗ Error seeding database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
