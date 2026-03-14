from playwright.sync_api import sync_playwright
import time

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:4173")
        page.wait_for_selector("#onboarding-modal")
        page.click("#start-game-btn")

        # Select an item, set quantity, buy, then verify
        page.fill("#trade-amount", "10")
        page.click("#buy-btn")
        time.sleep(2.5) # Wait for a tick to pass

        page.screenshot(path="screenshot-after-buy.png")
        browser.close()

if __name__ == "__main__":
    verify()
