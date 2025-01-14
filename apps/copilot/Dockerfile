# Use official Python runtime as base image
FROM python:3.11-slim

# Set working directory in container
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Expose port if your app needs it (adjust as needed)
ENV HOSTNAME="0.0.0.0"
ENV PORT=3001

# Command to run the application
CMD ["python", "app.py"]
