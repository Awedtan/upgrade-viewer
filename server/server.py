from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json

app = Flask(__name__)
CORS(app)

with open('./config.json', 'r') as config_file:
    config = json.load(config_file)
kroosterApi = config['kroosterApi']
kroosterHeaders = {'apikey': config['kroosterAnonKey']}


@app.route('/krooster_accounts', methods=['GET'])
def krooster_accounts():
    username = request.args.get('username')
    try:
        response = requests.get(
            f'{kroosterApi}/krooster_accounts?select=*&username=eq.{username}&limit=1', headers=kroosterHeaders)
        print(response.content)
        return (response.content, response.status_code, {
            'Content-Type': response.headers.get('Content-Type')
        })
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500


@app.route('/krooster_operators', methods=['GET'])
def krooster_operators():
    userId = request.args.get('userId')
    try:
        response = requests.get(
            f'{kroosterApi}/operators?select=*&user_id=eq.{userId}', headers=kroosterHeaders)
        return (response.content, response.status_code, {
            'Content-Type': response.headers.get('Content-Type')
        })
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500


@app.route('/sheet', methods=['GET'])
def sheet():
    id = request.args.get('id')
    gid = request.args.get('gid')
    try:
        response = requests.get(f'https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:json&tq&gid={gid}')
        return (response.content, response.status_code, {
            'Content-Type': response.headers.get('Content-Type')
        })
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(port=3001)
