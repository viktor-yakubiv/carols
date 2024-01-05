import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from html2text import html2text

def extract_content(url):
    response = requests.get(url)
    if response.status_code == 200:
        soup = BeautifulSoup(response.content, 'html.parser')
        title = soup.select_one('.art-postheader a').get_text()
        content = soup.select_one('.art-article')
        if content:
            content = html2text(str(content))
        return title, content
    else:
        print(f"Failed to fetch {url}")
        return None, None

if __name__ == "__main__":
    with open('urls.txt', 'r') as file:
        urls = file.readlines()
    urls = [url.strip() for url in urls]
    for url in urls:
        title, content = extract_content(url)
        name = urlparse(url).path.split('/')[-1]
        if title and content:
            with open(f'data/{name}.txt', 'w', encoding='utf-8') as file:
                file.write(f"{title}\n")
                file.write('=' * 64)
                file.write(f"{content}\n")

