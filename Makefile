.PHONY: help install data dev serve clean

# Default target
help:
	@echo "Available targets:"
	@echo "  install   - Install npm dependencies"
	@echo "  data      - Download conversations.jsonl from HuggingFace"
	@echo "  dev       - Install dependencies and start dev server (data optional)"
	@echo "  serve - Start development server on port 5000"
	@echo "  clean     - Clean downloaded data and node_modules"

# Install npm dependencies
install:
	npm install

# Download conversations.jsonl from HuggingFace
# Requires HF_TOKEN environment variable to be set
data:
	@if [ -z "$(HF_TOKEN)" ]; then \
		echo "Error: HF_TOKEN environment variable is required"; \
		echo "Please set your HuggingFace token: export HF_TOKEN=your_token_here"; \
		exit 1; \
	fi
	@echo "Downloading conversations.jsonl from HuggingFace..."
	@mkdir -p static/data
	@curl -L -H "Authorization: Bearer $(HF_TOKEN)" \
		"https://huggingface.co/datasets/ministere-culture/comparia-conversations/resolve/main/conversations.jsonl" \
		-o static/data/conversations.jsonl
	@echo "Downloaded conversations.jsonl to static/data/conversations.jsonl"

# Full development setup
dev: install
	@if [ -f "static/data/conversations.jsonl" ]; then \
		echo "Data file already exists, skipping download"; \
	else \
		echo "No data file found. You can:"; \
		echo "1. Set HF_TOKEN and run 'make data' to download"; \
		echo "2. Or continue without data (some features may not work)"; \
		echo ""; \
		if [ -n "$(HF_TOKEN)" ]; then \
			echo "HF_TOKEN found, downloading data..."; \
			$(MAKE) data; \
		else \
			echo "Continuing without data..."; \
		fi; \
	fi
	npm run dev

# Start development server on port 5000
serve:
	npm run dev -- --port 5000

# Clean everything
clean:
	rm -rf node_modules
	rm -rf static/data
	@echo "Cleaned node_modules and static/data"
