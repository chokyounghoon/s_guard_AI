import requests

url = "https://sguardai.khcho0421.workers.dev/sms/convert-multimodal"
with open("react.png", "rb") as f:
    files = {"file": ("react.png", f, "image/png")}
    response = requests.post(url, files=files)
    print("Status:", response.status_code)
    try:
        print("Response JSON:", response.json())
    except:
        print("Response Text:", response.text)
