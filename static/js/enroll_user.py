import cv2
import os

if not os.path.exists('data'):
    os.makedirs('data')

# Ask user for a Master PIN
master_pin = input("Enter a 4-digit Master PIN to secure your apps: ")
with open("data/master_pin.txt", "w") as f:
    f.write(master_pin)

cap = cv2.VideoCapture(0)
print("Camera starting... Press 's' to save face.")

while True:
    ret, frame = cap.read()
    cv2.imshow('Enrollment', frame)
    if cv2.waitKey(1) & 0xFF == ord('s'):
        cv2.imwrite("data/enrolled_user.jpg", frame)
        print(f"Success! Face and PIN ({master_pin}) enrolled.")
        break

cap.release()
cv2.destroyAllWindows()