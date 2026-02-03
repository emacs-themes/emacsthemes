#!/bin/bash

# Complex Shell sample for highlighting

RECIPES_DIR="recipies"
LOG_FILE="/tmp/theme-validator.log"
VERBOSE=false

function log() {
    local level=$1
    shift
    local msg="$*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $msg" | tee -a "$LOG_FILE"
}

if [[ "$1" == "--verbose" ]]; then
    VERBOSE=true
    shift
fi

log "INFO" "Starting recipe validation in $RECIPES_DIR"

if [ ! -d "$RECIPES_DIR" ]; then
    log "ERROR" "Directory $RECIPES_DIR does not exist"
    exit 1
fi

count=0
for file in "$RECIPES_DIR"/*.json; do
    if [ -f "$file" ]; then
        ((count++))
        if $VERBOSE; then
            log "DEBUG" "Checking $file..."
        fi
        
        # Simulate validation
        if grep -q "id" "$file"; then
            log "SUCCESS" "File $file is valid"
        else
            log "WARN" "File $file is missing ID"
        fi
    fi
done

log "INFO" "Validation completed. Total files: $count"
exit 0