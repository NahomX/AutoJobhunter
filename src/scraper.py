"""LinkedIn job scraper using Selenium. Importable by the CLI."""

import logging
import random
import time

import pandas as pd
from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException, WebDriverException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

logger = logging.getLogger(__name__)


class LinkedInJobScraper:
    def __init__(self, job_titles: list[str], location: str = "United States",
                 max_jobs: int = 5, headless: bool = False):
        self.job_titles = job_titles
        self.location = location
        self.max_jobs = max_jobs

        opts = Options()
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_argument("--start-maximized")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        if headless:
            opts.add_argument("--headless=new")

        self.driver = webdriver.Chrome(options=opts)
        self.driver.execute_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )

    def search_jobs(self, job_title: str):
        url = (
            f"https://www.linkedin.com/jobs/search/"
            f"?keywords={job_title.replace(' ', '%20')}"
            f"&location={self.location.replace(' ', '%20')}"
        )
        logger.info("Navigating to %s", url)
        self.driver.get(url)
        time.sleep(5)

    def scrape_jobs(self) -> pd.DataFrame:
        logger.info("Scraping job listings…")
        try:
            job_listings = WebDriverWait(self.driver, 10).until(
                EC.presence_of_all_elements_located(
                    (By.CSS_SELECTOR, "ul.jobs-search__results-list li")
                )
            )
        except TimeoutException:
            logger.warning("Timed out waiting for job listings — LinkedIn may have changed its layout.")
            return pd.DataFrame()

        logger.info("Found %d job cards", len(job_listings))
        jobs_data = []

        for job in job_listings[: self.max_jobs]:
            try:
                title   = job.find_element(By.CSS_SELECTOR, "h3").text.strip()
                company = job.find_element(By.CSS_SELECTOR, "h4").text.strip()
                link    = job.find_element(By.CSS_SELECTOR, "a").get_attribute("href")
            except NoSuchElementException as exc:
                logger.debug("Skipping card — element not found: %s", exc)
                continue

            # Best-effort: try to grab the description snippet shown in the card
            description = ""
            try:
                description = job.find_element(By.CSS_SELECTOR, "p").text.strip()
            except NoSuchElementException:
                pass

            jobs_data.append({
                "Title": title or "Unknown",
                "Company": company or "Unknown",
                "Link": link or "",
                "Description": description,
            })
            logger.debug("Scraped: %s @ %s", title, company)
            time.sleep(random.uniform(1, 2))

        return pd.DataFrame(jobs_data)

    def save_jobs(self, df: pd.DataFrame, filename: str = "linkedin_jobs.csv"):
        if df.empty:
            logger.warning("No data to save.")
            return
        df.to_csv(filename, index=False)
        logger.info("Saved %d listings to %s", len(df), filename)

    def close(self):
        self.driver.quit()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    titles = ["Data Scientist", "Data Engineer", "ML Engineer"]
    scraper = LinkedInJobScraper(job_titles=titles, max_jobs=5)
    try:
        frames = []
        for t in titles:
            scraper.search_jobs(t)
            frames.append(scraper.scrape_jobs())
            time.sleep(random.uniform(5, 8))
        all_jobs = pd.concat(frames, ignore_index=True)
        scraper.save_jobs(all_jobs)
    finally:
        scraper.close()
