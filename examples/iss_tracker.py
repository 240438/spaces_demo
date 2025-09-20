#!/usr/bin/env python3
"""
Simple ISS Tracker
Fetches and displays the current position of the International Space Station
"""

import requests
import json
from datetime import datetime

def get_iss_position():
    """Fetch the current position of the ISS"""
    try:
        response = requests.get("http://api.open-notify.org/iss-now.json")
        response.raise_for_status()
        data = response.json()
        
        if data["message"] == "success":
            position = data["iss_position"]
            timestamp = data["timestamp"]
            
            return {
                "latitude": float(position["latitude"]),
                "longitude": float(position["longitude"]),
                "timestamp": timestamp
            }
        else:
            return None
    except requests.RequestException as e:
        print(f"Error fetching ISS position: {e}")
        return None

def display_iss_info(position_data):
    """Display ISS position information"""
    if position_data:
        lat = position_data["latitude"]
        lon = position_data["longitude"]
        timestamp = position_data["timestamp"]
        
        # Convert timestamp to readable format
        dt = datetime.fromtimestamp(timestamp)
        
        print("🛰️  International Space Station Current Position")
        print("=" * 50)
        print(f"Latitude:  {lat:.4f}°")
        print(f"Longitude: {lon:.4f}°")
        print(f"Timestamp: {dt.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print()
        print(f"View on map: https://www.google.com/maps/@{lat},{lon},5z")
    else:
        print("❌ Unable to fetch ISS position")

def get_astronauts():
    """Fetch information about astronauts currently in space"""
    try:
        response = requests.get("http://api.open-notify.org/astros.json")
        response.raise_for_status()
        data = response.json()
        
        if data["message"] == "success":
            return {
                "number": data["number"],
                "people": data["people"]
            }
        else:
            return None
    except requests.RequestException as e:
        print(f"Error fetching astronaut data: {e}")
        return None

def display_astronauts(astro_data):
    """Display information about astronauts in space"""
    if astro_data:
        print(f"👨‍🚀 People Currently in Space: {astro_data['number']}")
        print("=" * 50)
        for person in astro_data["people"]:
            print(f"• {person['name']} - {person['craft']}")
    else:
        print("❌ Unable to fetch astronaut information")

if __name__ == "__main__":
    print("🚀 Space Tracker Demo\n")
    
    # Get and display ISS position
    iss_position = get_iss_position()
    display_iss_info(iss_position)
    
    print()
    
    # Get and display astronaut information
    astronauts = get_astronauts()
    display_astronauts(astronauts)
    
    print("\n⭐ Visit http://api.open-notify.org/ for more space APIs!")