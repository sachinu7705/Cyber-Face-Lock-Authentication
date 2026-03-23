from setuptools import setup, find_packages

setup(
    name="cyberlock",
    version="1.0.0",
    author="CyberLock Team",
    description="Face Recognition Security System",
    long_description="A secure biometric authentication system using face recognition",
    packages=find_packages(),
    include_package_data=True,
    package_data={
        'cyberlock': ['templates/*', 'static/*', 'models/*'],
    },
    install_requires=[
        "Flask>=2.3.3",
        "Flask-Mail>=0.9.1",
        "python-dotenv>=1.0.0",
        "bcrypt>=4.0.1",
        "cryptography>=41.0.7",
        "numpy>=1.24.3",
        "Pillow>=10.0.1",
        "opencv-python>=4.8.1.78",
        "dlib>=19.24.2",
        "face_recognition>=1.3.0",
        "flask-limiter>=3.5.0",
        "bleach>=6.0.0",
    ],
    entry_points={
        "console_scripts": [
            "cyberlock=cyberlock.web_app:main",
        ],
    },
    python_requires=">=3.8",
)
