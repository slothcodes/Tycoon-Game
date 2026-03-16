from playwright.sync_api import Page, expect, sync_playwright

def test_delist(page: Page):
    page.goto("http://localhost:5173/")

    page.wait_for_selector("#start-game-btn", state="visible")
    page.locator("#start-game-btn").click()

    page.wait_for_selector("#app", state="visible")

    # Just grab a screenshot
    page.screenshot(path="/home/jules/verification/merged.png")
    print("Screenshot saved to /home/jules/verification/merged.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_delist(page)
        finally:
            browser.close()
