"""
Traffic Data Recovery & Harmonizer Script
Restores deleted historical traffic observations from git version history,
standardizes schemas across all collection eras, and generates a unified CSV file.
"""

import os
import io
import subprocess
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')

def get_git_file(commit_hash, file_path):
    try:
        out = subprocess.check_output(['git', 'show', f'{commit_hash}:{file_path}'], stderr=subprocess.DEVNULL)
        return out.decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Warning: Could not extract {file_path} from {commit_hash}: {e}")
        return None

def restore_traffic_data():
    print("=" * 60)
    print("🚦 Dhaka Traffic Data Recovery & Harmonization Engine")
    print("=" * 60)

    from data_collection.merge_and_standardize import process_and_merge
    return process_and_merge()

if __name__ == '__main__':
    restore_traffic_data()

