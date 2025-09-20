#!/usr/bin/env python3
"""
Astronomical Distance Calculator
Calculate distances between celestial objects and convert between units
"""

def light_years_to_km(light_years):
    """Convert light years to kilometers"""
    # 1 light year = 9.461 × 10^12 km
    return light_years * 9.461e12

def au_to_km(au):
    """Convert Astronomical Units to kilometers"""
    # 1 AU = 149,597,870.7 km
    return au * 149597870.7

def km_to_light_years(km):
    """Convert kilometers to light years"""
    return km / 9.461e12

def km_to_au(km):
    """Convert kilometers to Astronomical Units"""
    return km / 149597870.7

def calculate_travel_time(distance_km, speed_kmh):
    """Calculate travel time given distance and speed"""
    time_hours = distance_km / speed_kmh
    time_days = time_hours / 24
    time_years = time_days / 365.25
    
    return {
        "hours": time_hours,
        "days": time_days,
        "years": time_years
    }

def main():
    print("🌌 Astronomical Distance Calculator")
    print("=" * 40)
    
    # Example calculations
    distances = {
        "Moon": 384400,  # km
        "Sun": 149597870.7,  # km (1 AU)
        "Mars (closest)": 54.6e6,  # km
        "Mars (farthest)": 401e6,  # km
        "Jupiter": 628.7e6,  # km
        "Proxima Centauri": 4.24 * 9.461e12,  # km (4.24 light years)
        "Andromeda Galaxy": 2.537e6 * 9.461e12  # km (2.537 million light years)
    }
    
    print("\n📏 Distances from Earth:")
    print("-" * 40)
    
    for object_name, distance_km in distances.items():
        print(f"\n🪐 {object_name}:")
        print(f"  Distance: {distance_km:,.0f} km")
        
        if distance_km < 1e9:  # Less than 1 billion km
            au_distance = km_to_au(distance_km)
            print(f"  Distance: {au_distance:.3f} AU")
        else:
            ly_distance = km_to_light_years(distance_km)
            if ly_distance < 1:
                print(f"  Distance: {ly_distance:.6f} light years")
            else:
                print(f"  Distance: {ly_distance:,.2f} light years")
    
    # Travel time calculations
    print("\n🚀 Travel Times (at different speeds):")
    print("-" * 40)
    
    target = "Mars (closest)"
    distance = distances[target]
    
    speeds = {
        "Walking": 5,  # km/h
        "Car": 100,  # km/h
        "Commercial Aircraft": 900,  # km/h
        "Space Shuttle": 28000,  # km/h
        "Parker Solar Probe": 200000,  # km/h (fastest human-made object)
        "Light": 1.08e9  # km/h
    }
    
    print(f"\nTime to reach {target} ({distance:,.0f} km):")
    
    for vehicle, speed in speeds.items():
        travel_time = calculate_travel_time(distance, speed)
        
        if travel_time["years"] > 1:
            print(f"  {vehicle}: {travel_time['years']:,.1f} years")
        elif travel_time["days"] > 1:
            print(f"  {vehicle}: {travel_time['days']:,.1f} days")
        else:
            print(f"  {vehicle}: {travel_time['hours']:,.1f} hours")

if __name__ == "__main__":
    main()