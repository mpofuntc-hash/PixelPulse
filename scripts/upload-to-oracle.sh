#!/bin/bash

# PixelPulse - Upload Anime to Oracle Cloud
# This script uploads anime videos from local hard drive to Oracle Cloud

# Configuration
LOCAL_ANIME_PATH="E:/PixelPulse"  # Your local anime folder
ORACLE_USER="ubuntu"              # Default Oracle Cloud username
ORACLE_IP=""                      # Your Oracle Cloud public IP
REMOTE_ANIME_PATH="/home/ubuntu/anime"  # Remote storage path

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}PixelPulse - Upload Anime to Oracle Cloud${NC}"
echo "============================================"
echo ""

# Check if Oracle IP is set
if [ -z "$ORACLE_IP" ]; then
    echo -e "${RED}Error: ORACLE_IP not set${NC}"
    echo "Please edit this script and set your Oracle Cloud public IP"
    exit 1
fi

# Check if local anime path exists
if [ ! -d "$LOCAL_ANIME_PATH" ]; then
    echo -e "${RED}Error: Local anime path not found: $LOCAL_ANIME_PATH${NC}"
    exit 1
fi

echo -e "${YELLOW}Configuration:${NC}"
echo "Local Path: $LOCAL_ANIME_PATH"
echo "Remote Server: $ORACLE_USER@$ORACLE_IP"
echo "Remote Path: $REMOTE_ANIME_PATH"
echo ""

# Create remote directory
echo -e "${YELLOW}Creating remote directory...${NC}"
ssh $ORACLE_USER@$ORACLE_IP "mkdir -p $REMOTE_ANIME_PATH"

# Upload anime files
echo -e "${YELLOW}Uploading anime files...${NC}"
echo "This may take a while depending on your internet speed and file sizes..."
echo ""

# Use rsync for efficient transfer (only transfer changed files)
rsync -avz --progress \
    --exclude '*.db' \
    --exclude 'node_modules' \
    --exclude '.git' \
    "$LOCAL_ANIME_PATH/" \
    $ORACLE_USER@$ORACLE_IP:$REMOTE_ANIME_PATH/

echo ""
echo -e "${GREEN}Upload complete!${NC}"
echo "Anime files are now available on Oracle Cloud at: $REMOTE_ANIME_PATH"
