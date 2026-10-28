import sys
import math
import array
import random
import numpy as np
import pygame
from sklearn.datasets import load_digits
from sklearn.neighbors import KNeighborsClassifier

# Initialize Pygame and Audio
pygame.init()
pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
pygame.font.init()

WIDTH, HEIGHT = 1150, 720
SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Count & Draw - ML Number Recognition")

# UI Palette
COLOR_BG = (246, 248, 252)
COLOR_PANEL = (236, 241, 248)
COLOR_TEXT = (45, 55, 72)
COLOR_PRIMARY = (70, 130, 240)
COLOR_CHECK = (45, 185, 105)
COLOR_CLEAR = (235, 85, 85)
COLOR_SCATTER = (245, 155, 45)
COLOR_INK = (35, 45, 75)

FONT_TITLE = pygame.font.SysFont("comicsansms", 26, bold=True)
FONT_BTN = pygame.font.SysFont("comicsansms", 17, bold=True)
FONT_STATUS = pygame.font.SysFont("comicsansms", 22, bold=True)
FONT_EMOJI = pygame.font.SysFont(["segoeuiemoji", "applecoloremoji", "notocoloremoji", "comicsansms"], 42)

# ----------------- Procedural Audio -----------------
def generate_sine_wave(frequency, duration, max_amp=9000):
    sample_rate = 44100
    num_samples = int(duration * sample_rate)
    audio_buffer = array.array("h")
    for i in range(num_samples):
        t = float(i) / sample_rate
        decay = 1.0 - (i / num_samples)
        sample = int(max_amp * math.sin(2.0 * math.pi * frequency * t) * (decay ** 1.4))
        audio_buffer.append(sample)
    return pygame.mixer.Sound(buffer=audio_buffer)

def generate_soft_bounce():
    sample_rate = 44100
    duration = 0.2
    num_samples = int(duration * sample_rate)
    audio_buffer = array.array("h")
    for i in range(num_samples):
        t = float(i) / sample_rate
        freq = 250 - (t * 190)
        decay = 1.0 - (i / num_samples)
        sample = int(7000 * math.sin(2.0 * math.pi * freq * t) * decay)
        audio_buffer.append(sample)
    return pygame.mixer.Sound(buffer=audio_buffer)

def generate_whoosh():
    sample_rate = 44100
    duration = 0.25
    num_samples = int(duration * sample_rate)
    audio_buffer = array.array("h")
    for i in range(num_samples):
        t = float(i) / sample_rate
        freq = 300 + math.sin(t * 25) * 120
        decay = 1.0 - (i / num_samples)
        sample = int(6000 * math.sin(2.0 * math.pi * freq * t) * decay)
        audio_buffer.append(sample)
    return pygame.mixer.Sound(buffer=audio_buffer)

SOUND_SUCCESS = generate_sine_wave(880.00, 0.28, max_amp=10000)
SOUND_MISS = generate_soft_bounce()
SOUND_SCATTER = generate_whoosh()


# ----------------- Machine Learning Model -----------------
def train_digit_classifier():
    """Trains a fast k-NN model on standard 8x8 handwritten digit samples."""
    digits = load_digits()
    X, y = digits.data, digits.target
    model = KNeighborsClassifier(n_neighbors=3, weights='distance')
    model.fit(X, y)
    return model

CLASSIFIER = train_digit_classifier()


# ----------------- UI Buttons & Entities -----------------
class Button:
    def __init__(self, rect, text, color=COLOR_PRIMARY):
        self.rect = pygame.Rect(rect)
        self.text = text
        self.color = color

    def draw(self, surface):
        pygame.draw.rect(surface, self.color, self.rect, border_radius=10)
        pygame.draw.rect(surface, (255, 255, 255), self.rect, 2, border_radius=10)
        txt = FONT_BTN.render(self.text, True, (255, 255, 255))
        surface.blit(txt, txt.get_rect(center=self.rect.center))

    def is_clicked(self, pos):
        return self.rect.collidepoint(pos)


class ScatteredItem:
    def __init__(self, emoji, home_pos, size=60):
        self.emoji = emoji
        self.size = size
        self.home_pos = list(home_pos)
        self.current_pos = [float(home_pos[0]), float(home_pos[1])]
        self.anim_target = None
        self.anim_speed = 0.22

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
        # Decorative card bubble
        r = pygame.Rect(int(self.current_pos[0]), int(self.current_pos[1]), self.size, self.size)
        pygame.draw.circle(surface, (255, 255, 255), r.center, self.size // 2)
        pygame.draw.circle(surface, (215, 225, 238), r.center, self.size // 2, 2)

        icon = FONT_EMOJI.render(self.emoji, True, (0, 0, 0))
        surface.blit(icon, icon.get_rect(center=r.center))


# ----------------- Drawing Slate & Image Recognition -----------------
class DrawingSlate:
    def __init__(self, rect):
        self.rect = pygame.Rect(rect)
        self.surface = pygame.Surface((self.rect.width, self.rect.height))
        self.surface.fill((255, 255, 255))
        self.points = []

    def clear(self):
        self.surface.fill((255, 255, 255))
        self.points.clear()

    def draw_stroke(self, pos):
        if self.rect.collidepoint(pos):
            rel_x = pos[0] - self.rect.x
            rel_y = pos[1] - self.rect.y
            self.points.append((rel_x, rel_y))
            # Smooth thick stroke
            pygame.draw.circle(self.surface, COLOR_INK, (rel_x, rel_y), 14)
            if len(self.points) > 1:
                pygame.draw.line(self.surface, COLOR_INK, self.points[-2], (rel_x, rel_y), 28)

    def end_stroke(self):
        self.points.clear()

    def recognize_digit(self):
        """Extracts the drawn digit, centers it, scales to 8x8, and classifies it."""
        # Convert surface to 2D numpy array
        raw_pixels = pygame.surfarray.array3d(self.surface)
        # Convert RGB to Grayscale
        gray = 0.2989 * raw_pixels[:, :, 0] + 0.5870 * raw_pixels[:, :, 1] + 0.1140 * raw_pixels[:, :, 2]
        # Invert: white background (0) to black strokes (16)
        ink_mask = 255 - gray
        
        # Check if slate is blank
        if np.max(ink_mask) < 40:
            return None

        # Find stroke bounding box
        coords = np.argwhere(ink_mask > 40)
        y_min, x_min = coords.min(axis=0)
        y_max, x_max = coords.max(axis=0)

        # Ensure minimal bounding size
        if (x_max - x_min < 10) or (y_max - y_min < 10):
            return None

        cropped = ink_mask[y_min:y_max+1, x_min:x_max+1]

        # Make square with padding
        h, w = cropped.shape
        max_dim = max(h, w)
        pad_top = (max_dim - h) // 2
        pad_left = (max_dim - w) // 2
        padded = np.zeros((max_dim, max_dim))
        padded[pad_top:pad_top+h, pad_left:pad_left+w] = cropped

        # Downsample to 8x8 (the format sklearn load_digits expects)
        # Rescale into temporary Pygame surface for smooth interpolation
        temp_surf = pygame.Surface((max_dim, max_dim))
        # pygame uses (w, h)
        temp_arr = np.repeat(padded[:, :, np.newaxis], 3, axis=2).astype(np.uint8)
        pygame.surfarray.blit_array(temp_surf, temp_arr)
        
        scaled_surf = pygame.transform.smoothscale(temp_surf, (8, 8))
        scaled_arr = pygame.surfarray.array3d(scaled_surf)[:, :, 0] # (8, 8)

        # Transpose & normalize to 0..16 as in scikit-learn dataset
        feature_vector = (scaled_arr.T / 255.0) * 16.0
        feature_vector = feature_vector.reshape(1, -1)

        prediction = CLASSIFIER.predict(feature_vector)[0]
        return int(prediction)

    def draw(self, target_surface):
        # Slate outer border
        pygame.draw.rect(target_surface, (255, 255, 255), self.rect, border_radius=16)
        target_surface.blit(self.surface, self.rect)
        pygame.draw.rect(target_surface, (200, 215, 235), self.rect, 3, border_radius=16)


# ----------------- Game State & Setup -----------------
ITEMS_POOL = ["🍎", "⭐", "🎈", "🐥", "🚗"]

def generate_scatter_positions(count, area_rect):
    pts = []
    cols = 3 if count <= 6 else 4
    rows = math.ceil(count / cols)
    step_x = area_rect.width // cols
    step_y = area_rect.height // rows

    for r in range(rows):
        for c in range(cols):
            if len(pts) < count:
                px = area_rect.x + c * step_x + random.randint(15, max(16, step_x - 75))
                py = area_rect.y + r * step_y + random.randint(15, max(16, step_y - 75))
                pts.append((px, py))
    random.shuffle(pts)
    return pts


def setup_round():
    # Pick a count between 1 and 9 for single-digit handwriting recognition
    target_count = random.randint(1, 9)
    item_icon = random.choice(ITEMS_POOL)

    scatter_rect = pygame.Rect(50, 110, 480, 480)
    pts = generate_scatter_positions(target_count, scatter_rect)

    items = []
    for i in range(target_count):
        items.append(ScatteredItem(item_icon, pts[i]))

    return items, target_count, scatter_rect


def main():
    clock = pygame.time.Clock()

    items, target_count, scatter_area = setup_round()

    # Right Slate & Buttons
    slate = DrawingSlate((580, 110, 480, 450))
    btn_check = Button((580, 580, 140, 45), "Check ✔", COLOR_CHECK)
    btn_clear = Button((740, 580, 140, 45), "Clear ✕", COLOR_CLEAR)
    btn_scatter = Button((50, 605, 150, 42), "Scatter Items", COLOR_SCATTER)
    btn_next = Button((220, 605, 140, 42), "New Round", COLOR_PRIMARY)

    is_drawing = False
    result_message = ""
    result_color = COLOR_TEXT

    running = True
    while running:
        clock.tick(60)
        mouse_pos = pygame.mouse.get_pos()

        for item in items:
            item.update()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                # Button Clicks
                if btn_check.is_clicked(mouse_pos):
                    pred = slate.recognize_digit()
                    if pred is None:
                        result_message = "Please write a number first!"
                        result_color = (210, 120, 30)
                    elif pred == target_count:
                        result_message = f"★ Awesome! You wrote {pred}! ★"
                        result_color = (35, 175, 75)
                        SOUND_SUCCESS.play()
                    else:
                        result_message = f"Saw '{pred}'. Count again and retry!"
                        result_color = (220, 70, 70)
                        SOUND_MISS.play()

                elif btn_clear.is_clicked(mouse_pos):
                    slate.clear()
                    result_message = ""

                elif btn_scatter.is_clicked(mouse_pos):
                    SOUND_SCATTER.play()
                    new_pts = generate_scatter_positions(len(items), scatter_area)
                    for idx, it in enumerate(items):
                        it.home_pos = list(new_pts[idx])
                        it.start_animation(it.home_pos)

                elif btn_next.is_clicked(mouse_pos):
                    items, target_count, scatter_area = setup_round()
                    slate.clear()
                    result_message = ""

                # Start drawing on slate
                elif slate.rect.collidepoint(mouse_pos):
                    is_drawing = True
                    slate.draw_stroke(mouse_pos)

            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                if is_drawing:
                    is_drawing = False
                    slate.end_stroke()

            elif event.type == pygame.MOUSEMOTION:
                if is_drawing:
                    slate.draw_stroke(mouse_pos)

        # ----------------- Rendering -----------------
        SCREEN.fill(COLOR_BG)

        # Header Title
        title = FONT_TITLE.render("Count the items on the left & write the number!", True, COLOR_TEXT)
        SCREEN.blit(title, title.get_rect(center=(WIDTH // 2, 45)))

        # Left Counting Container
        pygame.draw.rect(SCREEN, COLOR_PANEL, (40, 95, 500, 500), border_radius=18)
        pygame.draw.rect(SCREEN, (215, 225, 238), (40, 95, 500, 500), 2, border_radius=18)

        # Draw Items
        for item in items:
            item.draw(SCREEN)

        # Left Buttons
        btn_scatter.draw(SCREEN)
        btn_next.draw(SCREEN)

        # Right Slate
        slate.draw(SCREEN)
        btn_check.draw(SCREEN)
        btn_clear.draw(SCREEN)

        # Result Banner
        if result_message:
            msg = FONT_STATUS.render(result_message, True, result_color)
            SCREEN.blit(msg, (580, 645))

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()