from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import pandas as pd
import random


class LinkedInJobScraper:
    def __init__(self, job_titles, location="United States", max_jobs=5):
        self.job_titles = job_titles
        self.location = location
        self.max_jobs = max_jobs

        # Set up Chrome options
        chrome_options = Options()
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("--start-maximized")

        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    def search_jobs(self, job_title):
        """Search for jobs on LinkedIn."""
        search_url = f"https://www.linkedin.com/jobs/search/?keywords={job_title.replace(' ', '%20')}&location={self.location.replace(' ', '%20')}"
        print(f"Navigating to: {search_url}")
        self.driver.get(search_url)
        time.sleep(5)

    def scrape_jobs(self):
        """Scrape job postings from LinkedIn."""
        print("Beginning job scraping process...")

        try:
            job_listings = WebDriverWait(self.driver, 10).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, "ul.jobs-search__results-list li"))
            )
            print(f"Found {len(job_listings)} job cards")
        except:
            print("Could not find job listings on LinkedIn.")
            return pd.DataFrame()

        jobs_data = []

        for i, job in enumerate(job_listings[:self.max_jobs]):
            try:
                title_element = job.find_element(By.CSS_SELECTOR, "h3")
                company_element = job.find_element(By.CSS_SELECTOR, "h4")
                link_element = job.find_element(By.CSS_SELECTOR, "a")

                title = title_element.text.strip() if title_element else "Unknown"
                company = company_element.text.strip() if company_element else "Unknown"
                link = link_element.get_attribute("href") if link_element else "Unknown"

                print(f"Scraped: {title} at {company}, Link: {link}")

                jobs_data.append({"Title": title, "Company": company, "Link": link})
            except:
                print("Error extracting job details")
                continue

            time.sleep(random.uniform(1, 2))

        return pd.DataFrame(jobs_data)

    def save_jobs(self, df, filename="linkedin_jobs.csv"):
        """Save job postings to CSV."""
        if not df.empty:
            df.to_csv(filename, index=False)
            print(f"Data saved to {filename} - {len(df)} job listings")
        else:
            print("No data to save")

    def close(self):
        self.driver.quit()


if __name__ == "__main__":
    job_titles = ["Data Scientist", "Data Engineer", "Business Intelligence Engineer"]
    scraper = LinkedInJobScraper(job_titles=job_titles, max_jobs=5)

    try:
        all_jobs = pd.DataFrame()
        for title in job_titles:
            print(f"\n{'=' * 50}\nSearching for: {title}\n{'=' * 50}")
            scraper.search_jobs(title)
            jobs_df = scraper.scrape_jobs()
            if not jobs_df.empty:
                all_jobs = pd.concat([all_jobs, jobs_df], ignore_index=True)
            time.sleep(random.uniform(5, 8))
        scraper.save_jobs(all_jobs)
    finally:
        scraper.close()