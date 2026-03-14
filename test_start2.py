from playwright.sync_api import sync_playwright
import time

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"Error: {exc}"))
        page.goto("http://localhost:4173")
        time.sleep(1) # wait for DOMContentLoaded
        print("Before click, is hidden?:", page.evaluate("document.getElementById('app').classList.contains('hidden')"))
        page.click("#start-game-btn", timeout=5000)
        time.sleep(1)
        print("After click, is hidden?:", page.evaluate("document.getElementById('app').classList.contains('hidden')"))
        browser.close()

if __name__ == "__main__":
    test()
