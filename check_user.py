import sqlite3
db = sqlite3.connect('/home/ubuntu/PixelPulse/data/pixelpulse.db')
c = db.cursor()

# Check user_profiles schema
c.execute("PRAGMA table_info(user_profiles)")
print("user_profiles columns:")
for r in c.fetchall():
    print(f"  {r[1]} ({r[2]})")

# Check if user 2 has a profile
c.execute("SELECT * FROM user_profiles WHERE user_id=2")
print("\nUser 2 profile:")
for r in c.fetchall():
    print(f"  {r}")

# Check user 1 for comparison
c.execute("SELECT * FROM user_profiles WHERE user_id=1")
print("\nUser 1 profile:")
for r in c.fetchall():
    print(f"  {r}")

# Check user_avatar_unlocks
c.execute("PRAGMA table_info(user_avatar_unlocks)")
print("\nuser_avatar_unlocks columns:")
for r in c.fetchall():
    print(f"  {r[1]} ({r[2]})")

c.execute("SELECT * FROM user_avatar_unlocks WHERE user_id=2")
print("\nUser 2 avatar unlocks:")
for r in c.fetchall():
    print(f"  {r}")

db.close()
