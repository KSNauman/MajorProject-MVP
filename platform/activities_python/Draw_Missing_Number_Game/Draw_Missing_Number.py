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

WIDTH, HEIGHT = 1180, 740
SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Missing Number Detective - Write the Answer!")

# Visual Palette
COLOR_BG = (246, 248, 252)
COLOR_PANEL = (236, 241, 248)
COLOR_TEXT = (45, 55, 72)
COLOR_PRIMARY = (70, 130, 240)
COLOR_ACTIVE_BORDER = (45, 125, 245)
COLOR_CHECK = (45, 185, 105)
COLOR_CLEAR = (235, 85, 85)
COLOR_NEW = (245, 155, 45)
COLOR_INK = (35, 45, 75)

FONT_TITLE = pygame.font.SysFont("comicsansms", 26, bold=True)
FONT_BTN = pygame.font.SysFont("comicsansms", 16, bold=True)
FONT_INPUT = pygame.font.SysFont("comicsansms", 17, bold=True)
FONT_TRAIN_NUM = pygame.font.SysFont("comicsansms", 32, bold=True)
FONT_STATUS = pygame.font.SysFont("comicsansms", 22, bold=True)

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

def generate_win_chord():
    sample_rate = 44100
    duration = 0.55
    num_samples = int(duration * sample_rate)
    audio_buffer = array.array("h")
    freqs = [523.25, 659.25, 783.99]  # C5, E5, G5
    for i in range(num_samples):
        t = float(i) / sample_rate
        decay = 1.0 - (i / num_samples)
        sample_sum = sum(math.sin(2.0 * math.pi * f * t) for f in freqs) / 3.0
        sample = int(7500 * sample_sum * (decay ** 1.4))
        audio_buffer.append(sample)
    return pygame.mixer.Sound(buffer=audio_buffer)

SOUND_SUCCESS = generate_win_chord()
SOUND_MISS = generate_soft_bounce()


# ----------------- Machine Learning Digit Classifier -----------------
def train_digit_classifier():
    digits = load_digits()
    X, y = digits.data, digits.target
    model = KNeighborsClassifier(n_neighbors=3, weights='distance')
    model.fit(X, y)
    return model

CLASSIFIER = train_digit_classifier()


# ----------------- UI Buttons & Number Input -----------------
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


class NumberInputField:
    def __init__(self, x, y, label, initial_val, min_val=0, max_val=9):
        self.x = x
        self.y = y
        self.label = label
        self.val = initial_val
        self.min_val = min_val
        self.max_val = max_val
        self.text_buffer = str(initial_val)
        self.is_focused = False

        self.box_rect = pygame.Rect(x + 58, y, 48, 34)
        self.btn_minus = Button((x + 112, y, 28, 34), "-", COLOR_PRIMARY)
        self.btn_plus = Button((x + 144, y, 28, 34), "+", COLOR_PRIMARY)

    def draw(self, surface):
        lbl = FONT_INPUT.render(self.label, True, COLOR_TEXT)
        surface.blit(lbl, (self.x, self.y + 6))

        box_bg = (255, 255, 255) if not self.is_focused else (240, 248, 255)
        border_col = COLOR_ACTIVE_BORDER if self.is_focused else (190, 205, 225)
        pygame.draw.rect(surface, box_bg, self.box_rect, border_radius=6)
        pygame.draw.rect(surface, border_col, self.box_rect, 2 if not self.is_focused else 3, border_radius=6)

        display_text = self.text_buffer if self.is_focused else str(self.val)
        txt = FONT_INPUT.render(display_text, True, COLOR_TEXT)
        surface.blit(txt, txt.get_rect(center=self.box_rect.center))

        self.btn_minus.draw(surface)
        self.btn_plus.draw(surface)

    def handle_click(self, pos):
        if self.box_rect.collidepoint(pos):
            self.is_focused = True
            self.text_buffer = ""
            return False
        else:
            if self.is_focused:
                self.commit_text()
            self.is_focused = False

        if self.btn_minus.is_clicked(pos):
            if self.val > self.min_val:
                self.val -= 1
                self.text_buffer = str(self.val)
                return True
        elif self.btn_plus.is_clicked(pos):
            if self.val < self.max_val:
                self.val += 1
                self.text_buffer = str(self.val)
                return True
        return False

    def handle_key(self, event):
        if not self.is_focused:
            return False

        if event.key == pygame.K_RETURN:
            self.commit_text()
            self.is_focused = False
            return True
        elif event.key == pygame.K_BACKSPACE:
            self.text_buffer = self.text_buffer[:-1]
            return False
        elif event.unicode.isdigit():
            if len(self.text_buffer) < 1:
                self.text_buffer += event.unicode
            return False
        return False

    def commit_text(self):
        if self.text_buffer.strip():
            num = int(self.text_buffer)
            self.val = max(self.min_val, min(self.max_val, num))
        self.text_buffer = str(self.val)


# ----------------- Drawing Slate with 8x8 Feature Extraction -----------------
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
            pygame.draw.circle(self.surface, COLOR_INK, (rel_x, rel_y), 15)
            if len(self.points) > 1:
                pygame.draw.line(self.surface, COLOR_INK, self.points[-2], (rel_x, rel_y), 30)

    def end_stroke(self):
        self.points.clear()

    def recognize_digit(self):
        raw_pixels = pygame.surfarray.array3d(self.surface)
        gray = 0.2989 * raw_pixels[:, :, 0] + 0.5870 * raw_pixels[:, :, 1] + 0.1140 * raw_pixels[:, :, 2]
        ink_mask = 255 - gray

        if np.max(ink_mask) < 40:
            return None

        coords = np.argwhere(ink_mask > 40)
        y_min, x_min = coords.min(axis=0)
        y_max, x_max = coords.max(axis=0)

        if (x_max - x_min < 12) or (y_max - y_min < 12):
            return None

        cropped = ink_mask[y_min:y_max+1, x_min:x_max+1]
        h, w = cropped.shape
        max_dim = max(h, w)
        pad_top = (max_dim - h) // 2
        pad_left = (max_dim - w) // 2
        padded = np.zeros((max_dim, max_dim))
        padded[pad_top:pad_top+h, pad_left:pad_left+w] = cropped

        temp_surf = pygame.Surface((max_dim, max_dim))
        temp_arr = np.repeat(padded[:, :, np.newaxis], 3, axis=2).astype(np.uint8)
        pygame.surfarray.blit_array(temp_surf, temp_arr)

        scaled_surf = pygame.transform.smoothscale(temp_surf, (8, 8))
        scaled_arr = pygame.surfarray.array3d(scaled_surf)[:, :, 0]

        feature_vector = (scaled_arr.T / 255.0) * 16.0
        feature_vector = feature_vector.reshape(1, -1)

        prediction = CLASSIFIER.predict(feature_vector)[0]
        return int(prediction)

    def draw(self, target_surface):
        pygame.draw.rect(target_surface, (255, 255, 255), self.rect, border_radius=16)
        target_surface.blit(self.surface, self.rect)
        pygame.draw.rect(target_surface, (200, 215, 235), self.rect, 3, border_radius=16)


# ----------------- Sequence Train Setup -----------------
CARD_COLORS = [
    (240, 95, 95),   # Coral Red
    (250, 155, 45),  # Orange
    (245, 200, 40),  # Yellow
    (60, 195, 110),  # Green
    (65, 155, 245),  # Blue
    (170, 90, 230),  # Purple
]

def setup_sequence(start_val, end_val):
    numbers = list(range(start_val, end_val + 1))
    missing_idx = random.randint(0, len(numbers) - 1)
    missing_value = numbers[missing_idx]
    return numbers, missing_idx, missing_value


def main():
    clock = pygame.time.Clock()

    # Inputs (Restricted to single-digit range 0–9 for ML classifier)
    start_input = NumberInputField(50, 26, "Start:", initial_val=2, min_val=0, max_val=7)
    end_input = NumberInputField(240, 26, "End:", initial_val=6, min_val=2, max_val=9)

    btn_new = Button((435, 24, 130, 38), "New Riddle", COLOR_NEW)
    
    # Right Slate & Action Buttons
    slate = DrawingSlate((600, 110, 520, 440))
    btn_check = Button((600, 570, 150, 45), "Check ✔", COLOR_CHECK)
    btn_clear = Button((770, 570, 150, 45), "Clear ✕", COLOR_CLEAR)

    numbers, missing_idx, missing_value = setup_sequence(start_input.val, end_input.val)

    is_drawing = False
    is_solved = False
    status_text = ""
    status_color = COLOR_TEXT

    def refresh_range():
        nonlocal numbers, missing_idx, missing_value, is_solved, status_text
        if end_input.val <= start_input.val:
            end_input.val = min(9, start_input.val + 2)
            end_input.text_buffer = str(end_input.val)
        # Ensure at least 3 numbers and at most 6 for clean train rendering
        if (end_input.val - start_input.val + 1) > 6:
            end_input.val = start_input.val + 5
            end_input.text_buffer = str(end_input.val)

        numbers, missing_idx, missing_value = setup_sequence(start_input.val, end_input.val)
        is_solved = False
        status_text = ""
        slate.clear()

    running = True
    while running:
        clock.tick(60)
        mouse_pos = pygame.mouse.get_pos()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.KEYDOWN:
                c1 = start_input.handle_key(event)
                c2 = end_input.handle_key(event)
                if c1 or c2:
                    refresh_range()

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                # Stepper clicks
                c1 = start_input.handle_click(mouse_pos)
                c2 = end_input.handle_click(mouse_pos)
                if c1 or c2:
                    refresh_range()

                elif btn_new.is_clicked(mouse_pos):
                    refresh_range()

                elif btn_check.is_clicked(mouse_pos) and not is_solved:
                    pred = slate.recognize_digit()
                    if pred is None:
                        status_text = "Please write a number on the slate!"
                        status_color = (210, 120, 30)
                    elif pred == missing_value:
                        is_solved = True
                        status_text = f"★ Correct! The missing number was {missing_value}! ★"
                        status_color = (35, 175, 75)
                        SOUND_SUCCESS.play()
                    else:
                        status_text = f"Looks like '{pred}'. That's not the missing number, retry!"
                        status_color = (220, 70, 70)
                        SOUND_MISS.play()

                elif btn_clear.is_clicked(mouse_pos):
                    slate.clear()
                    status_text = ""

                # Slate Drawing
                elif slate.rect.collidepoint(mouse_pos) and not is_solved:
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

        # Header Title & Range Controls
        start_input.draw(SCREEN)
        end_input.draw(SCREEN)
        btn_new.draw(SCREEN)

        # Left Container (Number Sequence Train)
        train_panel = pygame.Rect(40, 95, 520, 560)
        pygame.draw.rect(SCREEN, COLOR_PANEL, train_panel, border_radius=18)
        pygame.draw.rect(SCREEN, (215, 225, 238), train_panel, 2, border_radius=18)

        panel_title = FONT_TITLE.render("Which number is missing?", True, COLOR_TEXT)
        SCREEN.blit(panel_title, panel_title.get_rect(center=(train_panel.centerx, train_panel.y + 45)))

        # Draw Number Train Blocks vertically or in a centered column
        count = len(numbers)
        block_w, block_h = 100, 75
        gap_y = 14
        total_h = count * block_h + (count - 1) * gap_y
        start_y = train_panel.centery - (total_h // 2) + 20

        for idx, num in enumerate(numbers):
            by = start_y + idx * (block_h + gap_y)
            bx = train_panel.centerx - (block_w // 2)
            card_rect = pygame.Rect(bx, by, block_w, block_h)

            if idx == missing_idx:
                if is_solved:
                    # Revealed missing number
                    pygame.draw.rect(SCREEN, (45, 185, 105), card_rect, border_radius=14)
                    pygame.draw.rect(SCREEN, (255, 255, 255), card_rect, 3, border_radius=14)
                    num_txt = FONT_TRAIN_NUM.render(str(missing_value), True, (255, 255, 255))
                    SCREEN.blit(num_txt, num_txt.get_rect(center=card_rect.center))
                else:
                    # Glowing '?' slot
                    pygame.draw.rect(SCREEN, (255, 255, 255), card_rect, border_radius=14)
                    pygame.draw.rect(SCREEN, (245, 140, 35), card_rect, 4, border_radius=14)
                    q_txt = FONT_TRAIN_NUM.render("?", True, (245, 140, 35))
                    SCREEN.blit(q_txt, q_txt.get_rect(center=card_rect.center))
            else:
                card_color = CARD_COLORS[idx % len(CARD_COLORS)]
                pygame.draw.rect(SCREEN, card_color, card_rect, border_radius=14)
                pygame.draw.rect(SCREEN, (255, 255, 255), card_rect, 2, border_radius=14)
                num_txt = FONT_TRAIN_NUM.render(str(num), True, (255, 255, 255))
                SCREEN.blit(num_txt, num_txt.get_rect(center=card_rect.center))

        # Right Drawing Slate & Buttons
        slate.draw(SCREEN)
        btn_check.draw(SCREEN)
        btn_clear.draw(SCREEN)

        # Status & Encouragement Text
        if status_text:
            msg = FONT_STATUS.render(status_text, True, status_color)
            SCREEN.blit(msg, (train_panel.x, HEIGHT - 55))

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()