from playwright.sync_api import sync_playwright
import time

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:4173")
        page.wait_for_selector("#onboarding-modal")
        page.click("#start-game-btn")
        time.sleep(1)
        page.screenshot(path="screenshot-dashboard2.png")
        browser.close()

if __name__ == "__main__":
    verify()
