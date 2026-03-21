import cv2
import json
import os

# 1. Update the JSON file with a new PIN
new_pin = input("Enter a new 4-digit PIN to save in pin.json: ")
with open('pin.json', 'w') as f:
    json.dump({"pin": new_pin}, f)

# 2. Proceed with Face Enrollment
cap = cv2.VideoCapture(0)
print(f"PIN updated to {new_pin}. Now, press 's' to save your face.")

while True:
    ret, frame = cap.read()
    cv2.imshow('Enrollment', frame)
    if cv2.waitKey(1) & 0xFF == ord('s'):
        cv2.imwrite("data/enrolled_user.jpg", frame)
        print("Success: Face and PIN synchronized.")
        break

cap.release()
cv2.destroyAllWindows()