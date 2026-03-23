from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="cyberlock",
    version="1.0.0",
    author="CyberLock Team",
    description="Face Recognition Security System",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/cyberlock",
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.10",
    install_requires=[
        "Flask>=2.3.3",
        "Flask-Mail>=0.9.1",
        "bcrypt>=4.0.1",
        "cryptography>=41.0.7",
        "numpy>=1.24.3",
        "Pillow>=10.0.1",
        "opencv-python>=4.8.1.78",
        "dlib>=19.24.2",
        "face_recognition>=1.3.0",
        "python-dotenv>=1.0.0",
    ],
    entry_points={
        "console_scripts": [
            "cyberlock=web_app:main",
        ],
    },
)