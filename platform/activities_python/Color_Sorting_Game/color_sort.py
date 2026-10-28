import sys
import math
import array
import random
import pygame

# Initialize Pygame and Audio Mixer
pygame.init()
pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
pygame.font.init()

WIDTH, HEIGHT = 1150, 720
SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Ball Color Sorting Basket")

# UI Palette
COLOR_BG = (246, 248, 252)
COLOR_SHELF = (236, 240, 248)
COLOR_TEXT = (45, 55, 72)
COLOR_BTN = (70, 130, 240)
COLOR_BTN_ACTIVE = (40, 180, 110)
COLOR_RESET = (235, 85, 85)

FONT_TITLE = pygame.font.SysFont("comicsansms", 26, bold=True)
FONT_BTN = pygame.font.SysFont("comicsansms", 18, bold=True)
FONT_BIN = pygame.font.SysFont("comicsansms", 20, bold=True)

# 6 Standard Colors Configuration
BINS_CONFIG = [
    {"name": "Red",    "color": (235, 60, 60),   "tint": (255, 230, 230)},
    {"name": "Orange", "color": (255, 135, 30),  "tint": (255, 240, 225)},
    {"name": "Yellow", "color": (245, 205, 30),  "tint": (255, 250, 220)},
    {"name": "Green",  "color": (45, 190, 95),   "tint": (225, 252, 235)},
    {"name": "Blue",   "color": (45, 125, 245),  "tint": (225, 240, 255)},
    {"name": "Purple", "color": (165, 70, 230),  "tint": (245, 230, 255)},
]

# ----------------- Procedural Audio -----------------
def generate_sine_wave(frequency, duration, max_amp=10000):
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
        freq = 240 - (t * 180)
        decay = 1.0 - (i / num_samples)
        sample = int(7000 * math.sin(2.0 * math.pi * freq * t) * decay)
        audio_buffer.append(sample)
    return pygame.mixer.Sound(buffer=audio_buffer)

SOUND_PICKUP = generate_sine_wave(587.33, 0.08, max_amp=6000)
SOUND_SUCCESS = generate_sine_wave(880.00, 0.22, max_amp=9000)
SOUND_BOUNCE = generate_soft_bounce()


# ----------------- Ball Asset Rendering -----------------
def create_ball_surface(rgb_color, size=52):
    """Draws a shiny, 3D shaded sphere."""
    surf = pygame.Surface((size, size), pygame.SRCALPHA)
    cx, cy = size // 2, size // 2
    radius = size // 2 - 2

    # Base Ball
    pygame.draw.circle(surf, rgb_color, (cx, cy), radius)

    # Shaded dark rim at bottom-right
    shadow_color = (max(0, rgb_color[0] - 60), max(0, rgb_color[1] - 60), max(0, rgb_color[2] - 60))
    pygame.draw.circle(surf, shadow_color, (cx, cy), radius, width=2)

    # Soft Highlight bubble at top-left
    hl_pos = (cx - radius // 3, cy - radius // 3)
    hl_surf = pygame.Surface((radius, radius), pygame.SRCALPHA)
    pygame.draw.circle(hl_surf, (255, 255, 255, 140), (radius // 2, radius // 2), radius // 2)
    surf.blit(hl_surf, (hl_pos[0] - radius // 4, hl_pos[1] - radius // 4))

    # Crisp specular dot
    pygame.draw.circle(surf, (255, 255, 255, 220), (cx - radius // 3, cy - radius // 3), 3)

    return surf


# ----------------- UI & Entities -----------------
class Button:
    def __init__(self, rect, text, color=COLOR_BTN):
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


class Ball:
    def __init__(self, color_name, rgb_color, home_pos, size=50):
        self.color_name = color_name
        self.size = size
        self.image = create_ball_surface(rgb_color, size)
        self.home_pos = list(home_pos)
        self.current_pos = list(home_pos)
        self.is_placed = False
        self.is_dragging = False
        self.drag_offset = (0, 0)

    @property
    def rect(self):
        return pygame.Rect(self.current_pos[0], self.current_pos[1], self.size, self.size)

    def draw(self, surface):
        if self.is_dragging:
            # Soft shadow underneath when dragging
            shadow = pygame.Surface((self.size, self.size), pygame.SRCALPHA)
            pygame.draw.circle(shadow, (0, 0, 0, 35), (self.size // 2, self.size // 2), self.size // 2)
            surface.blit(shadow, (self.current_pos[0] + 5, self.current_pos[1] + 7))

        surface.blit(self.image, self.current_pos)


class Basket:
    def __init__(self, rect, config):
        self.rect = pygame.Rect(rect)
        self.name = config["name"]
        self.color = config["color"]
        self.tint = config["tint"]
        self.collected_balls = []

    def get_next_ball_position(self, ball_size):
        """Arranges balls in neat rows inside the basket."""
        idx = len(self.collected_balls)
        padding_x = 12
        usable_w = self.rect.width - (2 * padding_x)
        balls_per_row = max(1, usable_w // (ball_size + 4))

        col = idx % balls_per_row
        row = idx // balls_per_row

        x = self.rect.x + padding_x + col * (ball_size + 4)
        # Fill from bottom upwards
        y = self.rect.bottom - 16 - ((row + 1) * (ball_size + 4))
        return [x, y]

    def draw(self, surface, is_hovered):
        fill_col = self.tint if is_hovered else (255, 255, 255)

        # Basket Basin
        pygame.draw.rect(surface, fill_col, self.rect, border_radius=16)
        pygame.draw.rect(surface, self.color, self.rect, width=4, border_radius=16)

        # Header rim
        rim = pygame.Rect(self.rect.x, self.rect.y, self.rect.width, 32)
        pygame.draw.rect(surface, self.color, rim, border_top_left_radius=14, border_top_right_radius=14)

        # Basket Name Label
        txt = FONT_BIN.render(self.name, True, (255, 255, 255))
        surface.blit(txt, txt.get_rect(center=rim.center))


# ----------------- Generator -----------------
def spawn_balls(total_count):
    shelf_rect = pygame.Rect(40, 90, WIDTH - 80, 160)
    ball_size = 48 if total_count > 12 else 52
    
    # Calculate non-overlapping grid positions on top shelf
    balls_per_row = min(12, total_count)
    cols = balls_per_row
    rows = math.ceil(total_count / cols)

    col_spacing = (shelf_rect.width - 60) // max(1, cols - 1) if cols > 1 else shelf_rect.width // 2
    row_spacing = 65

    positions = []
    for r in range(rows):
        for c in range(cols):
            if len(positions) < total_count:
                x = shelf_rect.x + 30 + c * col_spacing - (ball_size // 2)
                y = shelf_rect.y + 20 + r * row_spacing
                positions.append((x, y))

    random.shuffle(positions)

    # Distribute standard 6 colors evenly
    balls = []
    for i in range(total_count):
        cfg = BINS_CONFIG[i % len(BINS_CONFIG)]
        balls.append(Ball(cfg["name"], cfg["color"], positions[i], size=ball_size))

    random.shuffle(balls)
    return balls


def main():
    clock = pygame.time.Clock()

    # Create 6 Baskets across the bottom
    baskets = []
    num_bins = len(BINS_CONFIG)
    bin_w, bin_h = 160, 220
    bin_y = HEIGHT - bin_h - 30
    total_bins_w = num_bins * bin_w
    gap = (WIDTH - total_bins_w) // (num_bins + 1)

    for i, cfg in enumerate(BINS_CONFIG):
        bx = gap + i * (bin_w + gap)
        baskets.append(Basket((bx, bin_y, bin_w, bin_h), cfg))

    # Controls
    selected_count = 6
    btn_6 = Button((50, 25, 75, 40), "6", COLOR_BTN_ACTIVE)
    btn_12 = Button((135, 25, 75, 40), "12", COLOR_BTN)
    btn_18 = Button((220, 25, 75, 40), "18", COLOR_BTN)
    btn_reset = Button((WIDTH - 150, 25, 100, 40), "Reset", COLOR_RESET)

    balls = spawn_balls(selected_count)
    dragged_ball = None

    running = True
    while running:
        clock.tick(60)
        mouse_pos = pygame.mouse.get_pos()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                # Top Toolbar Click Handlers
                if btn_6.is_clicked(mouse_pos) and selected_count != 6:
                    selected_count = 6
                    btn_6.color, btn_12.color, btn_18.color = COLOR_BTN_ACTIVE, COLOR_BTN, COLOR_BTN
                    for b in baskets: b.collected_balls.clear()
                    balls = spawn_balls(selected_count)

                elif btn_12.is_clicked(mouse_pos) and selected_count != 12:
                    selected_count = 12
                    btn_6.color, btn_12.color, btn_18.color = COLOR_BTN, COLOR_BTN_ACTIVE, COLOR_BTN
                    for b in baskets: b.collected_balls.clear()
                    balls = spawn_balls(selected_count)

                elif btn_18.is_clicked(mouse_pos) and selected_count != 18:
                    selected_count = 18
                    btn_6.color, btn_12.color, btn_18.color = COLOR_BTN, COLOR_BTN, COLOR_BTN_ACTIVE
                    for b in baskets: b.collected_balls.clear()
                    balls = spawn_balls(selected_count)

                elif btn_reset.is_clicked(mouse_pos):
                    for b in baskets:
                        b.collected_balls.clear()
                    for ball in balls:
                        ball.is_placed = False
                        ball.current_pos = list(ball.home_pos)

                # Ball Selection (Draggable only if not placed)
                for ball in reversed(balls):
                    if not ball.is_placed and ball.rect.collidepoint(mouse_pos):
                        dragged_ball = ball
                        ball.is_dragging = True
                        ball.drag_offset = (ball.current_pos[0] - mouse_pos[0], ball.current_pos[1] - mouse_pos[1])
                        SOUND_PICKUP.play()

                        # Move to render front
                        balls.remove(ball)
                        balls.append(ball)
                        break

            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                if dragged_ball:
                    dragged_ball.is_dragging = False
                    placed_correctly = False

                    for basket in baskets:
                        # Ball center inside basket bounding box
                        if basket.rect.collidepoint(dragged_ball.rect.center):
                            if basket.name == dragged_ball.color_name:
                                placed_correctly = True
                                dragged_ball.is_placed = True
                                
                                # Move ball into its resting position inside the basket
                                target_xy = basket.get_next_ball_position(dragged_ball.size)
                                dragged_ball.current_pos = target_xy
                                basket.collected_balls.append(dragged_ball)
                                SOUND_SUCCESS.play()
                            break

                    if not placed_correctly:
                        # Soft bounce back to original shelf slot
                        dragged_ball.current_pos = list(dragged_ball.home_pos)
                        SOUND_BOUNCE.play()

                    dragged_ball = None

            elif event.type == pygame.MOUSEMOTION:
                if dragged_ball and dragged_ball.is_dragging:
                    dragged_ball.current_pos[0] = mouse_pos[0] + dragged_ball.drag_offset[0]
                    dragged_ball.current_pos[1] = mouse_pos[1] + dragged_ball.drag_offset[1]

        # ----------------- Rendering -----------------
        SCREEN.fill(COLOR_BG)

        # Header Title & Toolbar
        title = FONT_TITLE.render("Sort the balls into matching baskets!", True, COLOR_TEXT)
        SCREEN.blit(title, title.get_rect(center=(WIDTH // 2, 45)))

        btn_6.draw(SCREEN)
        btn_12.draw(SCREEN)
        btn_18.draw(SCREEN)
        btn_reset.draw(SCREEN)

        # Shelf Panel
        shelf_rect = pygame.Rect(40, 85, WIDTH - 80, 165)
        pygame.draw.rect(SCREEN, COLOR_SHELF, shelf_rect, border_radius=14)
        pygame.draw.rect(SCREEN, (215, 224, 236), shelf_rect, 2, border_radius=14)

        # Draw Baskets
        for basket in baskets:
            is_hovered = dragged_ball is not None and basket.rect.collidepoint(dragged_ball.rect.center)
            basket.draw(SCREEN, is_hovered)

        # Draw All Balls (both sorted in baskets and loose in shelf)
        for ball in balls:
            ball.draw(SCREEN)

        # Win State
        if all(b.is_placed for b in balls):
            win_txt = FONT_TITLE.render("★ All Sorted! Great Job! ★", True, (35, 170, 75))
            SCREEN.blit(win_txt, win_txt.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 10)))

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()