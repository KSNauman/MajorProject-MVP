import sys
import math
import array
import random
import pygame

pygame.init()
pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
pygame.font.init()

WIDTH, HEIGHT = 1180, 720
SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Shape Spotter - Find the Match!")

# Visual Palette
COLOR_BG = (246, 248, 252)
COLOR_CARD = (255, 255, 255)
COLOR_PANEL = (236, 241, 248)
COLOR_TEXT = (45, 55, 72)
COLOR_PRIMARY = (70, 130, 240)
COLOR_ACTIVE = (45, 185, 105)
COLOR_SCATTER = (245, 155, 45)
COLOR_NEXT = (155, 85, 235)

FONT_TITLE = pygame.font.SysFont("comicsansms", 26, bold=True)
FONT_SHAPE_NAME = pygame.font.SysFont("comicsansms", 30, bold=True)
FONT_BTN = pygame.font.SysFont("comicsansms", 17, bold=True)
FONT_TIMER = pygame.font.SysFont("comicsansms", 22, bold=True)
FONT_RESULT = pygame.font.SysFont("comicsansms", 24, bold=True)

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

SOUND_SUCCESS = generate_sine_wave(880.00, 0.3, max_amp=10000)
SOUND_MISS = generate_soft_bounce()
SOUND_SCATTER = generate_whoosh()

# ----------------- Shape Definitions & Geometry -----------------
SHAPE_NAMES = [
    "Circle", "Square", "Triangle", "Star", "Heart",
    "Diamond", "Hexagon", "Pentagon", "Moon", "Oval"
]

BRIGHT_COLORS = [
    (240, 80, 80),   # Red
    (250, 140, 35),  # Orange
    (245, 195, 30),  # Yellow
    (50, 185, 100),  # Green
    (55, 145, 245),  # Blue
    (165, 80, 235),  # Purple
    (245, 105, 170), # Pink
    (35, 180, 180)   # Teal
]

def draw_polygon_regular(surf, color, center, radius, n_points, rotation=0):
    pts = []
    cx, cy = center
    for i in range(n_points):
        ang = rotation + (i * 2 * math.pi / n_points) - (math.pi / 2)
        pts.append((cx + radius * math.cos(ang), cy + radius * math.sin(ang)))
    pygame.draw.polygon(surf, color, pts)
    pygame.draw.polygon(surf, (255, 255, 255), pts, 3)

def render_shape_surface(shape_name, color, size):
    surf = pygame.Surface((size, size), pygame.SRCALPHA)
    cx, cy = size // 2, size // 2
    r = size // 2 - 4

    if shape_name == "Circle":
        pygame.draw.circle(surf, color, (cx, cy), r)
        pygame.draw.circle(surf, (255, 255, 255), (cx, cy), r, 3)
    elif shape_name == "Square":
        rect = pygame.Rect(6, 6, size - 12, size - 12)
        pygame.draw.rect(surf, color, rect, border_radius=8)
        pygame.draw.rect(surf, (255, 255, 255), rect, 3, border_radius=8)
    elif shape_name == "Triangle":
        pts = [(cx, 4), (size - 6, size - 6), (6, size - 6)]
        pygame.draw.polygon(surf, color, pts)
        pygame.draw.polygon(surf, (255, 255, 255), pts, 3)
    elif shape_name == "Diamond":
        pts = [(cx, 4), (size - 6, cy), (cx, size - 6), (6, cy)]
        pygame.draw.polygon(surf, color, pts)
        pygame.draw.polygon(surf, (255, 255, 255), pts, 3)
    elif shape_name == "Pentagon":
        draw_polygon_regular(surf, color, (cx, cy), r, 5)
    elif shape_name == "Hexagon":
        draw_polygon_regular(surf, color, (cx, cy), r, 6)
    elif shape_name == "Oval":
        rect = pygame.Rect(4, size // 4, size - 8, size // 2)
        pygame.draw.ellipse(surf, color, rect)
        pygame.draw.ellipse(surf, (255, 255, 255), rect, 3)
    elif shape_name == "Star":
        pts = []
        for i in range(10):
            rad = r if i % 2 == 0 else r * 0.45
            ang = i * math.pi / 5 - math.pi / 2
            pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
        pygame.draw.polygon(surf, color, pts)
        pygame.draw.polygon(surf, (255, 255, 255), pts, 3)
    elif shape_name == "Heart":
        # Two overlapping circles and a base triangle
        w = size
        cr = int(w * 0.26)
        c1 = (int(w * 0.30), int(w * 0.32))
        c2 = (int(w * 0.70), int(w * 0.32))
        tri_pts = [(int(w * 0.08), int(w * 0.40)), (int(w * 0.92), int(w * 0.40)), (cx, int(w * 0.92))]
        pygame.draw.circle(surf, color, c1, cr)
        pygame.draw.circle(surf, color, c2, cr)
        pygame.draw.polygon(surf, color, tri_pts)
        pygame.draw.polygon(surf, (255, 255, 255), tri_pts, 3)
    elif shape_name == "Moon":
        pygame.draw.circle(surf, color, (cx, cy), r)
        # Punch out circle with transparent mask
        mask = pygame.Surface((size, size), pygame.SRCALPHA)
        pygame.draw.circle(mask, (0, 0, 0, 0), (cx + int(r * 0.55), cy - int(r * 0.2)), int(r * 0.85))
        surf.blit(mask, (0, 0), special_flags=pygame.BLEND_RGBA_MIN)

    # Specular shine
    pygame.draw.circle(surf, (255, 255, 255, 120), (cx - r // 3, cy - r // 3), max(3, r // 5))
    return surf


# ----------------- Game Entities -----------------
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


class ScatteredShape:
    def __init__(self, shape_name, color, home_pos, size):
        self.shape_name = shape_name
        self.color = color
        self.size = size
        self.image = render_shape_surface(shape_name, color, size)
        self.home_pos = list(home_pos)
        self.current_pos = [float(home_pos[0]), float(home_pos[1])]
        self.anim_target = None
        self.anim_speed = 0.22
        self.is_found = False

    @property
    def rect(self):
        return pygame.Rect(int(self.current_pos[0]), int(self.current_pos[1]), self.size, self.size)

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

    def draw(self, surface, highlight=False):
        pos = (int(self.current_pos[0]), int(self.current_pos[1]))
        if highlight or self.is_found:
            glow = pygame.Surface((self.size + 14, self.size + 14), pygame.SRCALPHA)
            pygame.draw.circle(glow, (45, 185, 105, 150), ((self.size + 14) // 2, (self.size + 14) // 2), (self.size + 14) // 2)
            surface.blit(glow, (pos[0] - 7, pos[1] - 7))

        surface.blit(self.image, pos)


# ----------------- Board Distribution -----------------
def generate_board(mode):
    # Mode params: count, pool of shapes, icon size
    if mode == "Easy":
        count = 6
        shape_pool = SHAPE_NAMES[:6]
        size = 80
    elif mode == "Medium":
        count = 12
        shape_pool = SHAPE_NAMES[:8]
        size = 68
    else: # Hard
        count = 20
        shape_pool = SHAPE_NAMES
        size = 56

    # Play area bounds
    play_x, play_y = 360, 110
    play_w, play_h = WIDTH - play_x - 40, HEIGHT - 150

    # Grid distribution with jitter
    cols = 5 if count > 12 else (4 if count > 6 else 3)
    rows = math.ceil(count / cols)
    step_x = play_w // cols
    step_y = play_h // rows

    points = []
    for r in range(rows):
        for c in range(cols):
            if len(points) < count:
                px = play_x + c * step_x + random.randint(10, max(12, step_x - size - 10))
                py = play_y + r * step_y + random.randint(10, max(12, step_y - size - 10))
                points.append((px, py))

    random.shuffle(points)

    # Pick shapes guaranteeing variety
    selected_shapes = []
    # Make sure at least one target candidate is included
    target_name = random.choice(shape_pool)
    target_color = random.choice(BRIGHT_COLORS)
    selected_shapes.append((target_name, target_color))

    for i in range(1, count):
        name = random.choice(shape_pool)
        col = random.choice(BRIGHT_COLORS)
        selected_shapes.append((name, col))

    random.shuffle(selected_shapes)

    shapes = []
    for idx, (name, col) in enumerate(selected_shapes):
        shapes.append(ScatteredShape(name, col, points[idx], size))

    return shapes, target_name, target_color, (play_x, play_y, play_w, play_h)


def main():
    clock = pygame.time.Clock()

    modes = ["Easy", "Medium", "Hard"]
    current_mode = "Easy"

    # Difficulty Buttons
    btn_modes = [
        Button((40 + i * 110, 24, 100, 38), modes[i], COLOR_ACTIVE if modes[i] == current_mode else COLOR_PRIMARY)
        for i in range(3)
    ]

    btn_scatter = Button((WIDTH - 280, 24, 120, 38), "Scatter", COLOR_SCATTER)
    btn_next = Button((WIDTH - 145, 24, 110, 38), "Next", COLOR_NEXT)

    shapes, target_name, target_color, play_area = generate_board(current_mode)
    target_img_large = render_shape_surface(target_name, target_color, 140)

    # Timer tracking
    start_time = pygame.time.get_ticks()
    elapsed_seconds = 0.0
    is_solved = False
    solved_time = 0.0

    running = True
    while running:
        clock.tick(60)
        mouse_pos = pygame.mouse.get_pos()

        # Update stopwatch if not yet solved
        if not is_solved:
            elapsed_seconds = (pygame.time.get_ticks() - start_time) / 1000.0

        for s in shapes:
            s.update()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                # Mode selection
                for i, btn in enumerate(btn_modes):
                    if btn.is_clicked(mouse_pos) and current_mode != modes[i]:
                        current_mode = modes[i]
                        for b in btn_modes: b.color = COLOR_PRIMARY
                        btn.color = COLOR_ACTIVE
                        shapes, target_name, target_color, play_area = generate_board(current_mode)
                        target_img_large = render_shape_surface(target_name, target_color, 140)
                        start_time = pygame.time.get_ticks()
                        is_solved = False
                        break

                # Scatter button
                if btn_scatter.is_clicked(mouse_pos):
                    SOUND_SCATTER.play()
                    step_x = play_area[2] // (5 if len(shapes) > 12 else (4 if len(shapes) > 6 else 3))
                    step_y = play_area[3] // math.ceil(len(shapes) / (5 if len(shapes) > 12 else (4 if len(shapes) > 6 else 3)))
                    cols = 5 if len(shapes) > 12 else (4 if len(shapes) > 6 else 3)

                    new_pts = []
                    for idx in range(len(shapes)):
                        c = idx % cols
                        r = idx // cols
                        px = play_area[0] + c * step_x + random.randint(10, max(12, step_x - shapes[0].size - 10))
                        py = play_area[1] + r * step_y + random.randint(10, max(12, step_y - shapes[0].size - 10))
                        new_pts.append((px, py))

                    random.shuffle(new_pts)
                    for idx, s in enumerate(shapes):
                        s.home_pos = list(new_pts[idx])
                        s.start_animation(s.home_pos)

                # Next shape button
                elif btn_next.is_clicked(mouse_pos):
                    shapes, target_name, target_color, play_area = generate_board(current_mode)
                    target_img_large = render_shape_surface(target_name, target_color, 140)
                    start_time = pygame.time.get_ticks()
                    is_solved = False

                # Shape selection click
                if not is_solved:
                    clicked_any = False
                    for s in reversed(shapes):
                        if s.rect.collidepoint(mouse_pos):
                            clicked_any = True
                            if s.shape_name == target_name:
                                s.is_found = True
                                is_solved = True
                                solved_time = elapsed_seconds
                                SOUND_SUCCESS.play()
                            else:
                                SOUND_MISS.play()
                            break

        # ----------------- Rendering -----------------
        SCREEN.fill(COLOR_BG)

        # Header Buttons
        for btn in btn_modes:
            btn.draw(SCREEN)
        btn_scatter.draw(SCREEN)
        btn_next.draw(SCREEN)

        # Left Target Panel (Card)
        target_card = pygame.Rect(40, 95, 280, HEIGHT - 135)
        pygame.draw.rect(SCREEN, COLOR_CARD, target_card, border_radius=18)
        pygame.draw.rect(SCREEN, (215, 225, 238), target_card, 2, border_radius=18)

        card_title = FONT_TITLE.render("Find this shape!", True, COLOR_TEXT)
        SCREEN.blit(card_title, card_title.get_rect(center=(target_card.centerx, target_card.y + 40)))

        # Target Shape Image & Name
        SCREEN.blit(target_img_large, target_img_large.get_rect(center=(target_card.centerx, target_card.y + 160)))
        shape_lbl = FONT_SHAPE_NAME.render(target_name, True, COLOR_TEXT)
        SCREEN.blit(shape_lbl, shape_lbl.get_rect(center=(target_card.centerx, target_card.y + 265)))

        # Stopwatch Display
        timer_box = pygame.Rect(target_card.x + 25, target_card.y + 320, target_card.width - 50, 50)
        pygame.draw.rect(SCREEN, COLOR_PANEL, timer_box, border_radius=12)
        time_str = f"⏱ Time: {elapsed_seconds:.1f}s" if not is_solved else f"⏱ Time: {solved_time:.1f}s"
        timer_txt = FONT_TIMER.render(time_str, True, COLOR_TEXT)
        SCREEN.blit(timer_txt, timer_txt.get_rect(center=timer_box.center))

        # Result Banner inside card
        if is_solved:
            res_txt = FONT_RESULT.render("★ Found it! ★", True, (35, 175, 75))
            SCREEN.blit(res_txt, res_txt.get_rect(center=(target_card.centerx, target_card.y + 420)))
            sub_res = FONT_BTN.render(f"Solved in {solved_time:.1f} seconds!", True, (35, 175, 75))
            SCREEN.blit(sub_res, sub_res.get_rect(center=(target_card.centerx, target_card.y + 455)))

        # Right Play Area
        play_rect = pygame.Rect(play_area[0], play_area[1] - 15, play_area[2], play_area[3] + 20)
        pygame.draw.rect(SCREEN, COLOR_PANEL, play_rect, border_radius=18)
        pygame.draw.rect(SCREEN, (215, 225, 238), play_rect, 2, border_radius=18)

        # Draw Scattered Shapes
        for s in shapes:
            s.draw(SCREEN)

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()