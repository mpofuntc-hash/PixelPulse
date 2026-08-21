import steamguard
from getpass import getpass

print("Steam Secret Extractor")
print("=====================")
print()

username = input("Steam Username: ")
password = getpass("Steam Password: ")

try:
    # Start login session
    print("\nLogging in to Steam...")
    session = steamguard.SteamSession(username, password)
    
    # Check if 2FA is needed
    if session.requires2FA:
        print("2FA code required. Enter code from your Steam mobile app:")
        code = input("2FA Code: ")
        session.login(code)
    else:
        session.login()
    
    print("\nLogin successful!")
    
    # Check if authenticator is already added
    if session.hasMobileAuthenticator:
        print("\nYou already have a mobile authenticator set up.")
        print("To extract secrets, you need to use the steamguard-cli tool or")
        print("manually extract from your phone's Steam app data.")
        print("\nAlternatively, I can modify the bot to work without secrets (manual 2FA).")
    else:
        print("\nNo mobile authenticator found on this account.")
        print("You need to set up Steam Guard Mobile Authenticator first:")
        print("1. Install Steam mobile app on your phone")
        print("2. Enable Steam Guard Mobile Authenticator")
        print("3. Then run this script again to extract secrets")
    
except Exception as e:
    print(f"\nError: {e}")
