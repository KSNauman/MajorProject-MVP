import sys
import math
import array
import random
import pygame

# Initialize Pygame and Audio Mixer
pygame.init()
pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
pygame.font.init()

WIDTH, HEIGHT = 1180, 740
SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Coloring Book - Fill the Colors!")

# UI Palette
COLOR_BG = (246, 248, 252)
COLOR_PANEL = (236, 241, 248)
COLOR_TEXT = (45, 55, 72)
COLOR_PRIMARY = (70, 130, 240)
COLOR_ACTIVE = (45, 185, 105)
COLOR_RESET = (235, 85, 85)

FONT_TITLE = pygame.font.SysFont("comicsansms", 26, bold=True)
FONT_BTN = pygame.font.SysFont("comicsansms", 16, bold=True)
FONT_LABEL = pygame.font.SysFont("comicsansms", 18, bold=True)
FONT_HINT = pygame.font.SysFont("comicsansms", 15, bold=True)

# ----------------- Procedural Audio -----------------
def generate_sine_wave(frequency, duration, max_amp=8000):
    sample_rate = 44100
    num_samples = int(duration * sample_rate)
    audio_buffer = array.array("h")
    for i in range(num_samples):
        t = float(i) / sample_rate
        decay = 1.0 - (i / num_samples)
        sample = int(max_amp * math.sin(2.0 * math.pi * frequency * t) * (decay ** 1.3))
        audio_buffer.append(sample)
    return pygame.mixer.Sound(buffer=audio_buffer)

def generate_soft_bounce():
    sample_rate = 44100
    duration = 0.18
    num_samples = int(duration * sample_rate)
    audio_buffer = array.array("h")
    for i in range(num_samples):
        t = float(i) / sample_rate
        freq = 240 - (t * 180)
        decay = 1.0 - (i / num_samples)
        sample = int(6000 * math.sin(2.0 * math.pi * freq * t) * decay)
        audio_buffer.append(sample)
    return pygame.mixer.Sound(buffer=audio_buffer)

def generate_win_chord():
    sample_rate = 44100
    duration = 0.6
    num_samples = int(duration * sample_rate)
    audio_buffer = array.array("h")
    # Soft Major Chord (C5, E5, G5)
    freqs = [523.25, 659.25, 783.99]
    for i in range(num_samples):
        t = float(i) / sample_rate
        decay = 1.0 - (i / num_samples)
        sample_sum = sum(math.sin(2.0 * math.pi * f * t) for f in freqs) / 3.0
        sample = int(7500 * sample_sum * (decay ** 1.5))
        audio_buffer.append(sample)
    return pygame.mixer.Sound(buffer=audio_buffer)

SOUND_PICKUP = generate_sine_wave(587.33, 0.08, max_amp=5000)
SOUND_FILL = generate_sine_wave(880.00, 0.25, max_amp=8000)
SOUND_BOUNCE = generate_soft_bounce()
SOUND_WIN = generate_win_chord()


# ----------------- Palette Colors -----------------
PAINT_COLORS = [
    {"name": "Red",    "rgb": (235, 60, 60)},
    {"name": "Orange", "rgb": (255, 135, 30)},
    {"name": "Yellow", "rgb": (250, 205, 35)},
    {"name": "Green",  "rgb": (50, 185, 95)},
    {"name": "Blue",   "rgb": (50, 130, 245)},
    {"name": "Brown",  "rgb": (145, 90, 50)},
]


# ----------------- UI Buttons & Confetti -----------------
class Button:
    def __init__(self, rect, text, color=COLOR_PRIMARY):
        self.rect = pygame.Rect(rect)
        self.text = text
        self.color = color

    def draw(self, surface):
        pygame.draw.rect(surface, self.color, self.rect, border_radius=8)
        pygame.draw.rect(surface, (255, 255, 255), self.rect, 2, border_radius=8)
        txt = FONT_BTN.render(self.text, True, (255, 255, 255))
        surface.blit(txt, txt.get_rect(center=self.rect.center))

    def is_clicked(self, pos):
        return self.rect.collidepoint(pos)


class ConfettiParticle:
    def __init__(self, x_bounds):
        self.x = random.randint(x_bounds[0], x_bounds[1])
        self.y = random.randint(-100, -10)
        self.size = random.randint(6, 12)
        self.color = random.choice([c["rgb"] for c in PAINT_COLORS])
        self.speed_y = random.uniform(2.5, 5.0)
        self.speed_x = random.uniform(-1.0, 1.0)

    def update(self):
        self.y += self.speed_y
        self.x += self.speed_x

    def draw(self, surface):
        pygame.draw.circle(surface, self.color, (int(self.x), int(self.y)), self.size // 2)


# ----------------- Paint Palette Blob -----------------
class PaintBlob:
    def __init__(self, color_name, rgb, home_pos, radius=32):
        self.color_name = color_name
        self.rgb = rgb
        self.home_pos = list(home_pos)
        self.current_pos = [float(home_pos[0]), float(home_pos[1])]
        self.radius = radius
        self.is_dragging = False
        self.drag_offset = (0, 0)
        self.anim_target = None
        self.anim_speed = 0.22

    @property
    def rect(self):
        return pygame.Rect(int(self.current_pos[0]) - self.radius, 
                           int(self.current_pos[1]) - self.radius, 
                           self.radius * 2, self.radius * 2)

    def start_animation(self, target_xy):
        self.anim_target = list(target_xy)

    def update(self):
        if self.anim_target:
            dx = self.anim_target[0] - self.current_pos[0]
            dy = self.anim_target[1] - self.current_pos[1]
            dist = math.hypot(dx, dy)
            if dist < 2.0:
                self.current_pos = list(self.anim_target)
                self.anim_target = None
            else:
                self.current_pos[0] += dx * self.anim_speed
                self.current_pos[1] += dy * self.anim_speed

    def draw(self, surface):
        cx, cy = int(self.current_pos[0]), int(self.current_pos[1])
        # Drop shadow when dragged
        if self.is_dragging:
            shadow = pygame.Surface((self.radius * 2 + 10, self.radius * 2 + 10), pygame.SRCALPHA)
            pygame.draw.circle(shadow, (0, 0, 0, 35), (self.radius + 5, self.radius + 5), self.radius)
            surface.blit(shadow, (cx - self.radius, cy - self.radius + 6))

        # Main Paint Droplet
        pygame.draw.circle(surface, self.rgb, (cx, cy), self.radius)
        pygame.draw.circle(surface, (255, 255, 255), (cx, cy), self.radius, 3)
        # Specular shine
        pygame.draw.circle(surface, (255, 255, 255, 180), (cx - self.radius // 3, cy - self.radius // 3), max(3, self.radius // 3))

        # Text label below the home spot
        if not self.is_dragging:
            lbl = FONT_LABEL.render(self.color_name, True, COLOR_TEXT)
            surface.blit(lbl, lbl.get_rect(center=(self.home_pos[0], self.home_pos[1] + self.radius + 16)))


# ----------------- Fillable Object Parts -----------------
class FillPart:
    def __init__(self, name, required_color, shape_type, params, label_pos):
        self.name = name
        self.required_color = required_color
        self.shape_type = shape_type  # "circle", "ellipse", "polygon", "rect"
        self.params = params          # Coordinates/radii
        self.label_pos = label_pos    # (x, y) where hint text renders
        self.is_filled = False
        self.fill_color = (255, 255, 255)

    def hit_test(self, pos):
        """Checks if a dropped coordinate lands inside this part."""
        px, py = pos
        if self.shape_type == "circle":
            cx, cy, r = self.params
            return math.hypot(px - cx, py - cy) <= r
        elif self.shape_type == "ellipse":
            x, y, w, h = self.params
            norm_x = (px - (x + w / 2)) / (w / 2)
            norm_y = (py - (y + h / 2)) / (h / 2)
            return (norm_x ** 2 + norm_y ** 2) <= 1.0
        elif self.shape_type == "rect":
            x, y, w, h = self.params
            return pygame.Rect(x, y, w, h).collidepoint(pos)
        elif self.shape_type == "polygon":
            poly = self.params
            # Ray-casting point-in-polygon
            inside = False
            n = len(poly)
            p1x, p1y = poly[0]
            for i in range(n + 1):
                p2x, p2y = poly[i % n]
                if py > min(p1y, p2y):
                    if py <= max(p1y, p2y):
                        if px <= max(p1x, p2x):
                            if p1y != p2y:
                                xinters = (py - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                            if p1x == p2x or px <= xinters:
                                inside = not inside
                p1x, p1y = p2x, p2y
            return inside
        return False

    def draw(self, surface):
        col = self.fill_color if self.is_filled else (255, 255, 255)
        outline_col = (50, 60, 75)

        if self.shape_type == "circle":
            cx, cy, r = self.params
            pygame.draw.circle(surface, col, (cx, cy), r)
            pygame.draw.circle(surface, outline_col, (cx, cy), r, 4)
        elif self.shape_type == "ellipse":
            rect = pygame.Rect(self.params)
            pygame.draw.ellipse(surface, col, rect)
            pygame.draw.ellipse(surface, outline_col, rect, 4)
        elif self.shape_type == "rect":
            rect = pygame.Rect(self.params)
            pygame.draw.rect(surface, col, rect, border_radius=6)
            pygame.draw.rect(surface, outline_col, rect, 4, border_radius=6)
        elif self.shape_type == "polygon":
            pygame.draw.polygon(surface, col, self.params)
            pygame.draw.polygon(surface, outline_col, self.params, 4)

        # Hint text if not yet colored
        if not self.is_filled:
            hint = FONT_HINT.render(f"Fill {self.required_color}", True, (110, 125, 145))
            surface.blit(hint, hint.get_rect(center=self.label_pos))


# ----------------- Preset Coloring Objects -----------------
def create_apple():
    # Fruit: Apple
    # Stem, Leaf, Apple Body
    stem = FillPart("Stem", "Brown", "rect", (292, 195, 16, 50), (300, 180))
    leaf = FillPart("Leaf", "Green", "ellipse", (308, 205, 75, 45), (345, 227))
    body = FillPart("Body", "Red", "circle", (300, 360, 125), (300, 360))
    return [stem, leaf, body], "🍎 Fruit: Juicy Apple"

def create_carrot():
    # Vegetable: Carrot
    # Leaves (triangles/polys), Body (tapered poly)
    leaves = FillPart("Leaves", "Green", "polygon", 
                      [(270, 240), (220, 160), (290, 190), (310, 145), (330, 190), (400, 160), (350, 240)], 
                      (310, 190))
    body = FillPart("Body", "Orange", "polygon", 
                     [(265, 240), (355, 240), (310, 480)], 
                     (310, 320))
    return [leaves, body], "🥕 Vegetable: Crunch Carrot"

def create_duck():
    # Animal: Duck
    # Pond (ellipse), Body (ellipse), Head (circle), Beak (poly)
    pond = FillPart("Water", "Blue", "ellipse", (120, 420, 380, 80), (310, 460))
    body = FillPart("Body", "Yellow", "ellipse", (210, 300, 190, 120), (300, 360))
    head = FillPart("Head", "Yellow", "circle", (230, 270, 52), (230, 270))
    beak = FillPart("Beak", "Orange", "polygon", [(180, 270), (140, 285), (180, 295)], (165, 312))
    return [pond, body, head, beak], "🐥 Animal: Little Duckling"


def main():
    clock = pygame.time.Clock()

    # Object Selection Buttons
    btn_apple = Button((40, 25, 110, 42), "Apple", COLOR_ACTIVE)
    btn_carrot = Button((160, 25, 110, 42), "Carrot", COLOR_PRIMARY)
    btn_duck = Button((280, 25, 110, 42), "Duck", COLOR_PRIMARY)
    btn_reset = Button((WIDTH - 150, 25, 110, 42), "Reset", COLOR_RESET)

    current_object = "Apple"
    parts, object_title = create_apple()

    # Paint Palette Shelf (Right Side)
    shelf_rect = pygame.Rect(720, 95, 420, HEIGHT - 130)
    paint_blobs = []
    shelf_cols = 2
    for idx, pc in enumerate(PAINT_COLORS):
        col = idx % shelf_cols
        row = idx // shelf_cols
        bx = shelf_rect.x + 105 + col * 200
        by = shelf_rect.y + 80 + row * 165
        paint_blobs.append(PaintBlob(pc["name"], pc["rgb"], (bx, by)))

    dragged_blob = None
    confetti = []
    is_completed = False

    def load_object(obj_type):
        nonlocal parts, object_title, is_completed, confetti
        is_completed = False
        confetti.clear()
        if obj_type == "Apple":
            parts, object_title = create_apple()
        elif obj_type == "Carrot":
            parts, object_title = create_carrot()
        elif obj_type == "Duck":
            parts, object_title = create_duck()

    running = True
    while running:
        clock.tick(60)
        mouse_pos = pygame.mouse.get_pos()

        # Update animations
        for b in paint_blobs:
            b.update()

        if is_completed:
            for c in confetti:
                c.update()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                # Top Buttons
                if btn_apple.is_clicked(mouse_pos) and current_object != "Apple":
                    current_object = "Apple"
                    btn_apple.color, btn_carrot.color, btn_duck.color = COLOR_ACTIVE, COLOR_PRIMARY, COLOR_PRIMARY
                    load_object("Apple")
                elif btn_carrot.is_clicked(mouse_pos) and current_object != "Carrot":
                    current_object = "Carrot"
                    btn_apple.color, btn_carrot.color, btn_duck.color = COLOR_PRIMARY, COLOR_ACTIVE, COLOR_PRIMARY
                    load_object("Carrot")
                elif btn_duck.is_clicked(mouse_pos) and current_object != "Duck":
                    current_object = "Duck"
                    btn_apple.color, btn_carrot.color, btn_duck.color = COLOR_PRIMARY, COLOR_PRIMARY, COLOR_ACTIVE
                    load_object("Duck")

                elif btn_reset.is_clicked(mouse_pos):
                    load_object(current_object)
                    SOUND_BOUNCE.play()

                # Pick up a paint blob
                for blob in reversed(paint_blobs):
                    if blob.anim_target is None and blob.rect.collidepoint(mouse_pos):
                        dragged_blob = blob
                        blob.is_dragging = True
                        blob.drag_offset = (blob.current_pos[0] - mouse_pos[0], blob.current_pos[1] - mouse_pos[1])
                        SOUND_PICKUP.play()

                        # Layer to front
                        paint_blobs.remove(blob)
                        paint_blobs.append(blob)
                        break

            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                if dragged_blob:
                    dragged_blob.is_dragging = False
                    filled_any = False

                    # Check hit on object parts
                    for part in reversed(parts):
                        if not part.is_filled and part.hit_test(mouse_pos):
                            if part.required_color == dragged_blob.color_name:
                                part.is_filled = True
                                part.fill_color = dragged_blob.rgb
                                SOUND_FILL.play()
                                filled_any = True

                                # Check victory
                                if all(p.is_filled for p in parts) and not is_completed:
                                    is_completed = True
                                    SOUND_WIN.play()
                                    confetti = [ConfettiParticle((50, 650)) for _ in range(70)]
                            break

                    if not filled_any:
                        # Soft spring-back to palette
                        dragged_blob.start_animation(dragged_blob.home_pos)
                        SOUND_BOUNCE.play()
                    else:
                        # Return dropper quietly to shelf so it can be reused
                        dragged_blob.start_animation(dragged_blob.home_pos)

                    dragged_blob = None

            elif event.type == pygame.MOUSEMOTION:
                if dragged_blob and dragged_blob.is_dragging:
                    dragged_blob.current_pos[0] = float(mouse_pos[0] + dragged_blob.drag_offset[0])
                    dragged_blob.current_pos[1] = float(mouse_pos[1] + dragged_blob.drag_offset[1])

        # ----------------- Rendering -----------------
        SCREEN.fill(COLOR_BG)

        # Header Buttons
        btn_apple.draw(SCREEN)
        btn_carrot.draw(SCREEN)
        btn_duck.draw(SCREEN)
        btn_reset.draw(SCREEN)

        # Left Coloring Easel Canvas
        art_canvas = pygame.Rect(40, 95, 640, HEIGHT - 130)
        pygame.draw.rect(SCREEN, (255, 255, 255), art_canvas, border_radius=18)
        pygame.draw.rect(SCREEN, (215, 225, 238), art_canvas, 2, border_radius=18)

        # Object Title Banner
        title_txt = FONT_TITLE.render(object_title, True, COLOR_TEXT)
        SCREEN.blit(title_txt, (art_canvas.x + 30, art_canvas.y + 24))

        # Draw Object Parts
        for part in parts:
            part.draw(SCREEN)

        # Draw Eyes for Duckling if filled
        if current_object == "Duck":
            pygame.draw.circle(SCREEN, (40, 40, 40), (218, 260), 6)
            pygame.draw.circle(SCREEN, (255, 255, 255), (216, 258), 2)

        # Confetti Celebration
        if is_completed:
            for c in confetti:
                c.draw(SCREEN)
            # Victory Banner
            win_banner = FONT_TITLE.render("★ Beautiful! All Colored In! ★", True, (40, 175, 80))
            SCREEN.blit(win_banner, win_banner.get_rect(center=(art_canvas.centerx, art_canvas.bottom - 45)))

        # Right Paint Palette Shelf
        pygame.draw.rect(SCREEN, COLOR_PANEL, shelf_rect, border_radius=18)
        pygame.draw.rect(SCREEN, (215, 225, 238), shelf_rect, 2, border_radius=18)

        shelf_title = FONT_TITLE.render("Color Palette", True, COLOR_TEXT)
        SCREEN.blit(shelf_title, shelf_title.get_rect(center=(shelf_rect.centerx, shelf_rect.y + 36)))

        # Draw Paint Blobs
        for b in paint_blobs:
            b.draw(SCREEN)

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()