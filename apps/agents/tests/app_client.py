from src.utils.common import common_logger, read_json_from_file
logger = common_logger
logger.info("Running swarm_flask_client.py")

import requests
from pprint import pprint

if __name__ == "__main__":
    request = read_json_from_file("./tests/sample_requests/example4.json").get("lastRequest", {})
    print("Sending request...")
    logger.info("Sending request...")
    response = requests.post(
        "http://localhost:4040/chat",
        json=request
    ).json()

    print("Output: ")
    logger.info(f"Output: ")
    # for k, v in response.items():
    #     print(f"{k}: {v}")
    #     print('*'*200)
    #     print('*'*200)
    #     logger.info(f"{k}: {v}")
    #     logger.info('*'*200)
    #     logger.info('='*200)
    pprint(response, indent=2)
    logger.info(response)