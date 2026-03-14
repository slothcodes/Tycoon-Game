from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:4173")
        page.wait_for_selector("#onboarding-modal")
        page.screenshot(path="screenshot-onboarding.png")
        page.click("#start-game-btn")
        page.wait_for_selector(".dashboard-grid")
        page.screenshot(path="screenshot-dashboard.png")
        browser.close()

if __name__ == "__main__":
    verify()
