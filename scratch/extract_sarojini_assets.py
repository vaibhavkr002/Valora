from PIL import Image
import os

img_path = 'assets/sarojni/sarojni_hm_cover.png'
im = Image.open(img_path)
w, h = im.size
print(f"Loaded image: {w}x{h}")

output_dir = 'assets/sarojni'

# 1. Extract Top Banner (0 to ~388px)
# Let's inspect the banner boundary:
# The banner has a slight drop shadow or horizontal line around y=385-390
banner = im.crop((0, 0, w, 388))
banner.save(os.path.join(output_dir, 'sarojini-top-banner.png'), quality=95)
print("Saved sarojini-top-banner.png (1536x388)")

# 2. Extract Category Circles (Y approx 390 to 520)
# Let's calculate the X positions for the 8 circles:
# Total 8 circles across 1536px width.
# Circle 1: Tops (around x=74, y=400, radius approx 55 -> diameter 110)
# Let's find the centers of the 8 circles.
# Spacing between circles is approximately (1536 - margins) / 8 ~ 170-180px

category_crops = [
    ("cat-tops.png", (68, 395, 188, 515)),
    ("cat-tees.png", (248, 395, 368, 515)),
    ("cat-jeans.png", (428, 395, 548, 515)),
    ("cat-dresses.png", (608, 395, 728, 515)),
    ("cat-bags.png", (788, 395, 908, 515)),
    ("cat-sneakers.png", (968, 395, 1088, 515)),
    ("cat-accessories.png", (1148, 395, 1268, 515)),
    ("cat-caps.png", (1328, 395, 1448, 515))
]

for filename, box in category_crops:
    cat_img = im.crop(box)
    cat_img.save(os.path.join(output_dir, filename), quality=95)
    print(f"Saved {filename} {box}")

# 3. Extract Product Images (Y approx 640 to 805)
# 6 product cards across the width:
# Card 1: Ribbed Striped Top
# Card 2: Oversized Graphic Tee
# Card 3: Wide Leg Jeans
# Card 4: Ruched Mini Dress
# Card 5: Classic Sneakers
# Card 6: Retro Shoulder Bag

product_crops = [
    ("prod-1-striped-top.png", (52, 642, 260, 804)),
    ("prod-2-graphic-tee.png", (292, 642, 500, 804)),
    ("prod-3-wide-jeans.png", (532, 642, 740, 804)),
    ("prod-4-ruched-dress.png", (772, 642, 980, 804)),
    ("prod-5-classic-sneakers.png", (1012, 642, 1220, 804)),
    ("prod-6-retro-bag.png", (1252, 642, 1460, 804))
]

for filename, box in product_crops:
    prod_img = im.crop(box)
    prod_img.save(os.path.join(output_dir, filename), quality=95)
    print(f"Saved {filename} {box}")

# 4. Extract "Fashion for Everyone" badge (bottom right)
badge_crop = (1140, 895, 1500, 975)
badge_img = im.crop(badge_crop)
badge_img.save(os.path.join(output_dir, 'badge-fashion-for-everyone.png'), quality=95)
print("Saved badge-fashion-for-everyone.png")

