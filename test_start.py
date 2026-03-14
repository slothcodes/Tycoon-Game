from playwright.sync_api import sync_playwright

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"Error: {exc}"))
        page.goto("http://localhost:4173")
        page.click("#start-game-btn", timeout=5000)
        print("Clicked successfully!")
        browser.close()

if __name__ == "__main__":
    test()
