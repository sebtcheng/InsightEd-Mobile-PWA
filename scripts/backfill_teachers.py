import os
import psycopg2
from dotenv import load_dotenv

def backfill_teachers():
    # Load environment variables
    load_dotenv()
    
    # Get database URL from environment variables
    db_url = os.getenv('DATABASE_URL') or os.getenv('NEW_DATABASE_URL')
    
    if not db_url:
        print("❌ Error: DATABASE_URL or NEW_DATABASE_URL not found in .env file.")
        return

    print("🚀 Connecting to database...")
    
    conn = None
    try:
        # Connect to the database
        # For Azure/Production Postgres, we usually need SSL
        conn = psycopg2.connect(db_url, sslmode='require')
        cur = conn.cursor()
        
        print("✅ Connected successfully.")
        
        # SQL logic:
        # 1. Identify all registered schools from the users table (where role is 'School Head' and lastName is the school_id)
        # 2. Insert corresponding teachers from teachers_list into teacher_specialization_details
        # 3. Use ON CONFLICT (control_num) DO NOTHING to prevent duplicates
        
        backfill_query = """
        INSERT INTO teacher_specialization_details (
            iern, control_num, school_id, full_name, position, position_group, 
            specialization, teaching_load, created_at, updated_at
        )
        SELECT 
            tl."iern", 
            tl."control_num", 
            tl."school.id", 
            TRIM(CONCAT(tl."first.name", ' ', tl."middle.name", ' ', tl."last.name")), 
            tl."position", 
            tl."position.group", 
            tl."specialization.final", 
            0, 
            NOW(), 
            NOW()
        FROM teachers_list tl
        INNER JOIN (
            -- Get unique school IDs from registered School Heads
            -- Per api/index.js, School Heads have their school_id stored in first_name or last_name depending on registration logic
            -- But we can also get them from school_profiles if they were successfully registered
            SELECT school_id FROM school_profiles
        ) sp ON tl."school.id" = sp.school_id
        ON CONFLICT (control_num) DO NOTHING;
        """
        
        print("📊 Running backfill query...")
        cur.execute(backfill_query)
        
        rows_affected = cur.rowcount
        conn.commit()
        
        print(f"🎉 Success! Rows backfilled/inserted: {rows_affected}")
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
    finally:
        if conn:
            conn.close()
            print("🔌 Database connection closed.")

if __name__ == "__main__":
    backfill_teachers()
