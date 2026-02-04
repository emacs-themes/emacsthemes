# Complex Python sample for highlighting
import os
import json
from datetime import datetime
from typing import List, Optional

class ThemeProcessor:
    """Processes theme files for Emacs."""
    
    DEFAULT_TIMEOUT = 30  # seconds
    
    def __init__(self, recipes_dir: str):
        self.recipes_dir = recipes_dir
        self.processed_count = 0

    def list_recipes(self) -> List[str]:
        """Returns a list of JSON files in the recipes directory."""
        if not os.path.exists(self.recipes_dir):
            return []
            
        files = [f for f in os.listdir(self.recipes_dir) if f.endswith('.json')]
        return sorted(files)

    async def process_recipe(self, filename: str) -> Optional[dict]:
        try:
            path = os.path.join(self.recipes_dir, filename)
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            self.processed_count += 1
            print(f"[{datetime.now()}] Processed {data.get('name', 'Unknown')}")
            return data
        except (IOError, json.JSONDecodeError) as e:
            print(f"Error processing {filename}: {e}")
            return None

if __name__ == "__main__":
    processor = ThemeProcessor(recipes_dir="recipes")
    recipes = processor.list_recipes()
    print(f"Found {len(recipes)} recipes.")
    
    # Example of a multi-line string
    query = """
    SELECT id, name FROM themes
    WHERE status = 'active'
    """