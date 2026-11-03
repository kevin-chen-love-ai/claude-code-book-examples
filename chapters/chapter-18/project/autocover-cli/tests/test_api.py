import os
from openai import OpenAI

API_KEY = os.environ.get("ARK_API_KEY", "your-ark-api-key-here")
BASE_URL = "https://ark.cn-beijing.volces.com/api/coding/v3"

def test_api():
    print("Testing connection to Volcengine API...")
    client = OpenAI(
        api_key=API_KEY,
        base_url=BASE_URL,
    )
    
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello, simply say 'API works' if you receive this."}
    ]
    model = "doubao-seed-2.0-pro"
    
    print(f"Requesting model: {model}")
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
        )
        
        print("Response received: ", end="")
        for chunk in response:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                print(chunk.choices[0].delta.content, end="", flush=True)
        print("\n\n[Test Passed!]")
    except Exception as e:
        print(f"\n[Test Failed with Error: {e}]")

if __name__ == "__main__":
    test_api()
