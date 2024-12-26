import requests
import json

def print_json_structure(data, indent=0, max_depth=5):
    if indent > max_depth:
        return
    if isinstance(data, dict):
        for key, value in data.items():
            print('  ' * indent + str(key))
            print_json_structure(value, indent + 1)
    elif isinstance(data, list):
        for i, item in enumerate(data):
            print('  ' * indent + f'[{i}]')
            print_json_structure(item, indent + 1)
    else:
        print('  ' * indent + str(type(data).__name__))

def fetch_and_print_json_structure(url):
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()
    print_json_structure(data)

if __name__ == "__main__":
    url = "https://app.parlamento.pt/webutils/docs/doc.txt?path=6148523063446f764c324679626d56304c3239775a57356b595852684c3052685a47397a51574a6c636e52766379394a626d5a76636d3168773666446f32386c4d6a424359584e6c4c3168574a5449775447566e61584e7359585231636d45765357356d62334a7459574e6862304a6863325659566c3971633239754c6e523464413d3d&fich=InformacaoBaseXV_json.txt&Inline=true"
    fetch_and_print_json_structure(url)