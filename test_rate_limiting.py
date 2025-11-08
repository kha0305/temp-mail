#!/usr/bin/env python3
"""
Script để test rate limiting và failover của TempMail API
Chạy script này để kiểm tra các fixes đã được áp dụng
"""

import requests
import time
import json
from datetime import datetime

# Backend URL
BASE_URL = "http://localhost:8001/api"

def print_separator():
    print("\n" + "="*70 + "\n")

def print_timestamp():
    return datetime.now().strftime("%H:%M:%S")

def get_provider_stats():
    """Lấy stats từ backend"""
    try:
        response = requests.get(BASE_URL)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"❌ Error getting stats: {e}")
        return None

def print_stats():
    """In ra provider stats"""
    data = get_provider_stats()
    if not data:
        return
    
    print(f"\n📊 PROVIDER STATS [{print_timestamp()}]")
    print("-" * 70)
    
    stats = data.get("stats", {})
    for provider, info in stats.items():
        status = info.get("status", "unknown")
        success = info.get("success", 0)
        failures = info.get("failures", 0)
        success_rate = info.get("success_rate", "N/A")
        
        status_emoji = "✅" if status == "active" else "⏸️"
        print(f"{status_emoji} {provider.upper()}")
        print(f"   Status: {status}")
        print(f"   Success: {success} | Failures: {failures}")
        print(f"   Success Rate: {success_rate}")
        print()

def create_email(attempt_num):
    """Tạo email mới"""
    try:
        print(f"\n[{print_timestamp()}] 🔄 Attempt #{attempt_num}: Creating email...")
        
        response = requests.post(
            f"{BASE_URL}/emails/create",
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            email = data.get("address")
            provider = data.get("provider")
            print(f"[{print_timestamp()}] ✅ Success! Email: {email}")
            print(f"   Provider: {provider}")
            return True
        elif response.status_code == 429:
            print(f"[{print_timestamp()}] ⚠️ Rate Limited (429)")
            return False
        elif response.status_code == 503:
            print(f"[{print_timestamp()}] ⚠️ Service Unavailable (503)")
            error = response.json().get("detail", "Unknown error")
            print(f"   Detail: {error}")
            return False
        else:
            print(f"[{print_timestamp()}] ❌ Failed with status {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"[{print_timestamp()}] ⏱️ Request timeout")
        return False
    except Exception as e:
        print(f"[{print_timestamp()}] ❌ Error: {e}")
        return False

def test_rapid_creation(count=10, delay=1):
    """Test tạo email liên tục để trigger rate limiting"""
    print_separator()
    print(f"🧪 TEST: Rapid Email Creation ({count} attempts, {delay}s delay)")
    print_separator()
    
    success_count = 0
    fail_count = 0
    
    for i in range(1, count + 1):
        result = create_email(i)
        
        if result:
            success_count += 1
        else:
            fail_count += 1
        
        # Delay giữa các requests
        if i < count:
            time.sleep(delay)
    
    print_separator()
    print(f"📈 RESULTS:")
    print(f"   Success: {success_count}/{count}")
    print(f"   Failed: {fail_count}/{count}")
    print(f"   Success Rate: {(success_count/count*100):.1f}%")
    
    # In stats sau khi test
    print_stats()

def test_cache_effectiveness():
    """Test xem cache có hoạt động không"""
    print_separator()
    print("🧪 TEST: Cache Effectiveness")
    print_separator()
    
    print("📝 Tạo 3 emails liên tục để test cache...")
    print("   (Nếu cache hoạt động, sẽ thấy 'Using cached domains' trong backend logs)")
    
    for i in range(1, 4):
        create_email(i)
        time.sleep(0.5)  # Delay ngắn để test cache
    
    print("\n💡 TIP: Check backend logs để xem 'Using cached domains'")

def test_cooldown_recovery():
    """Test recovery sau khi cooldown"""
    print_separator()
    print("🧪 TEST: Cooldown Recovery")
    print_separator()
    
    print("📝 Bước 1: Trigger rate limit...")
    
    # Tạo emails nhanh để trigger rate limit
    for i in range(1, 6):
        create_email(i)
        time.sleep(0.5)
    
    print("\n📝 Bước 2: Chờ 70 giây để cooldown expire...")
    print("   (Cooldown duration: 60s + 10s buffer)")
    
    for remaining in range(70, 0, -10):
        print(f"   ⏳ Remaining: {remaining}s...")
        time.sleep(10)
    
    print("\n📝 Bước 3: Test lại sau khi cooldown...")
    create_email("recovery")
    
    print_stats()

def main():
    """Main menu"""
    print("="*70)
    print("🧪 TEMPMAIL API - RATE LIMITING TEST SUITE")
    print("="*70)
    
    # Check backend availability
    print("\n🔍 Checking backend availability...")
    stats = get_provider_stats()
    if not stats:
        print("❌ Backend không khả dụng tại:", BASE_URL)
        print("   Vui lòng đảm bảo backend đang chạy trên port 8001")
        return
    
    print("✅ Backend available!")
    print_stats()
    
    while True:
        print("\n" + "="*70)
        print("MENU:")
        print("  1. Test Rapid Creation (10 emails, 1s delay)")
        print("  2. Test Rapid Creation (20 emails, 0.5s delay)")
        print("  3. Test Cache Effectiveness")
        print("  4. Test Cooldown Recovery (takes ~70s)")
        print("  5. View Current Stats")
        print("  6. Create Single Email")
        print("  0. Exit")
        print("="*70)
        
        choice = input("\nChọn option (0-6): ").strip()
        
        if choice == "1":
            test_rapid_creation(10, 1)
        elif choice == "2":
            test_rapid_creation(20, 0.5)
        elif choice == "3":
            test_cache_effectiveness()
        elif choice == "4":
            confirm = input("\n⚠️ Test này sẽ mất ~70 giây. Tiếp tục? (y/n): ")
            if confirm.lower() == 'y':
                test_cooldown_recovery()
        elif choice == "5":
            print_stats()
        elif choice == "6":
            create_email("manual")
            print_stats()
        elif choice == "0":
            print("\n👋 Bye!")
            break
        else:
            print("\n❌ Invalid option")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n🛑 Interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
