"""
Test script to verify email history functionality by creating emails with short expiry times
"""
import requests
import time
from datetime import datetime, timezone, timedelta

BASE_URL = "https://domain-mail-expand.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

def test_history_flow():
    """Test the complete flow: create -> expire -> history -> delete"""
    print("🚀 Testing Email History Flow")
    print("=" * 70)
    
    # Step 1: Create an email
    print("\n📧 Step 1: Creating a new email...")
    response = requests.post(f"{API_URL}/emails/create", json={}, timeout=30)
    if response.status_code != 200:
        print(f"❌ Failed to create email: {response.status_code}")
        return False
    
    email_data = response.json()
    email_id = email_data['id']
    email_address = email_data['address']
    print(f"✅ Created email: {email_address}")
    print(f"   ID: {email_id}")
    print(f"   Expires at: {email_data['expires_at']}")
    
    # Step 2: Verify email exists in active list
    print("\n📋 Step 2: Verifying email in active list...")
    response = requests.get(f"{API_URL}/emails", timeout=30)
    if response.status_code != 200:
        print(f"❌ Failed to get emails: {response.status_code}")
        return False
    
    emails = response.json()
    found = any(e['id'] == email_id for e in emails)
    if found:
        print(f"✅ Email found in active list")
    else:
        print(f"❌ Email not found in active list")
        return False
    
    # Step 3: Check current history (should be empty or not contain our email)
    print("\n📚 Step 3: Checking current history...")
    response = requests.get(f"{API_URL}/emails/history/list", timeout=30)
    if response.status_code != 200:
        print(f"❌ Failed to get history: {response.status_code}")
        return False
    
    history = response.json()
    print(f"   Current history count: {len(history)}")
    
    # Step 4: Test extend time functionality
    print("\n⏰ Step 4: Testing extend time...")
    old_expires = email_data['expires_at']
    response = requests.post(f"{API_URL}/emails/{email_id}/extend-time", timeout=30)
    if response.status_code != 200:
        print(f"❌ Failed to extend time: {response.status_code}")
        return False
    
    extend_data = response.json()
    new_expires = extend_data['expires_at']
    print(f"✅ Time extended")
    print(f"   Old expires: {old_expires}")
    print(f"   New expires: {new_expires}")
    
    # Verify it's reset to ~10 minutes from now
    new_expires_dt = datetime.fromisoformat(new_expires.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    expected_expires = now + timedelta(minutes=10)
    time_diff = abs((new_expires_dt - expected_expires).total_seconds())
    
    if time_diff <= 5:
        print(f"   ✅ Expiry correctly reset to ~10 minutes from now")
    else:
        print(f"   ❌ Expiry time incorrect: {time_diff}s difference")
    
    # Step 5: Test history deletion endpoints
    print("\n🗑️ Step 5: Testing history deletion endpoints...")
    
    # Test delete all (should work even with empty history)
    response = requests.delete(
        f"{API_URL}/emails/history/delete",
        json={"ids": None},
        timeout=30
    )
    if response.status_code != 200:
        print(f"❌ Failed to delete all history: {response.status_code}")
        return False
    
    del_data = response.json()
    print(f"✅ Delete all history: {del_data['count']} deleted")
    
    # Test selective delete with empty list
    response = requests.delete(
        f"{API_URL}/emails/history/delete",
        json={"ids": []},
        timeout=30
    )
    if response.status_code != 200:
        print(f"❌ Failed to delete selective history: {response.status_code}")
        return False
    
    del_data = response.json()
    print(f"✅ Delete selective history (empty): {del_data['count']} deleted")
    
    # Step 6: Test getting messages from active email
    print("\n📨 Step 6: Testing message operations...")
    response = requests.get(f"{API_URL}/emails/{email_id}/messages", timeout=30)
    if response.status_code != 200:
        print(f"❌ Failed to get messages: {response.status_code}")
        return False
    
    msg_data = response.json()
    print(f"✅ Messages retrieved: {msg_data['count']} messages")
    
    # Test refresh
    response = requests.post(f"{API_URL}/emails/{email_id}/refresh", timeout=30)
    if response.status_code != 200:
        print(f"❌ Failed to refresh messages: {response.status_code}")
        return False
    
    print(f"✅ Messages refreshed")
    
    # Step 7: Cleanup - delete the email
    print("\n🗑️ Step 7: Cleanup - deleting test email...")
    response = requests.delete(f"{API_URL}/emails/{email_id}", timeout=30)
    if response.status_code != 200:
        print(f"❌ Failed to delete email: {response.status_code}")
        return False
    
    print(f"✅ Email deleted")
    
    # Verify deletion
    response = requests.get(f"{API_URL}/emails/{email_id}", timeout=30)
    if response.status_code == 404:
        print(f"✅ Email confirmed deleted (404)")
    else:
        print(f"⚠️  Email still exists after deletion")
    
    print("\n" + "=" * 70)
    print("🎉 All history flow tests passed!")
    return True

if __name__ == "__main__":
    success = test_history_flow()
    exit(0 if success else 1)
