import sys
import math
import array
import random
import pygame

pygame.init()
pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
pygame.font.init()

WIDTH, HEIGHT = 1180, 740
SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Fruit Match - Draw the Line!")

# Visual Palette
COLOR_BG = (246, 248, 252)
COLOR_TEXT = (45, 55, 72)
COLOR_PRIMARY = (70, 130, 240)
COLOR_SCATTER_FRUIT = (245, 140, 35)
COLOR_SCATTER_NAME = (155, 85, 235)
COLOR_RESET = (235, 85, 85)
COLOR_LINE_ACTIVE = (90, 160, 250)
COLOR_LINE_MATCHED = (45, 185, 105)

FONT_TITLE = pygame.font.SysFont("comicsansms", 26, bold=True)
FONT_BTN = pygame.font.SysFont("comicsansms", 16, bold=True)
FONT_NAME = pygame.font.SysFont("comicsansms", 22, bold=True)
FONT_EMOJI = pygame.font.SysFont(["segoeuiemoji", "applecoloremoji", "notocoloremoji", "comicsansms"], 46)

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

SOUND_PICKUP = generate_sine_wave(587.33, 0.08, max_amp=6000)
SOUND_SUCCESS = generate_sine_wave(880.00, 0.22, max_amp=9000)
SOUND_MISS = generate_soft_bounce()
SOUND_SCATTER = generate_whoosh()


# ----------------- Fruit Catalog -----------------
FRUIT_CATALOG = [
    ("Apple", "🍎", (255, 230, 230)),
    ("Banana", "🍌", (255, 250, 215)),
    ("Orange", "🍊", (255, 235, 215)),
    ("Grapes", "🍇", (245, 225, 255)),
    ("Strawberry", "🍓", (255, 225, 235)),
    ("Watermelon", "🍉", (230, 250, 235)),
]


# ----------------- UI Buttons & Cards -----------------
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


class FruitCard:
    def __init__(self, name, emoji, tint, home_pos, size=(130, 80)):
        self.name = name
        self.emoji = emoji
        self.tint = tint
        self.w, self.h = size
        self.home_pos = list(home_pos)
        self.current_pos = [float(home_pos[0]), float(home_pos[1])]
        self.is_matched = False
        
        # Flight animation
        self.anim_target = None
        self.anim_speed = 0.22

    @property
    def rect(self):
        return pygame.Rect(int(self.current_pos[0]), int(self.current_pos[1]), self.w, self.h)

    @property
    def pin_pos(self):
        # Anchor pin on the right edge
        return (int(self.current_pos[0]) + self.w, int(self.current_pos[1]) + self.h // 2)

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

    def draw(self, surface, is_selected=False):
        r = self.rect
        pygame.draw.rect(surface, self.tint, r, border_radius=14)
        border_col = (45, 185, 105) if self.is_matched else ((100, 160, 245) if is_selected else (205, 215, 230))
        pygame.draw.rect(surface, border_col, r, 3 if is_selected or self.is_matched else 2, border_radius=14)

        # Fruit Icon
        emoji_txt = FONT_EMOJI.render(self.emoji, True, (0, 0, 0))
        surface.blit(emoji_txt, emoji_txt.get_rect(center=(r.centerx - 10, r.centery)))

        # Right Pin Dot
        pin_col = (45, 185, 105) if self.is_matched else (70, 130, 240)
        pygame.draw.circle(surface, pin_col, self.pin_pos, 8)
        pygame.draw.circle(surface, (255, 255, 255), self.pin_pos, 4)


class NameCard:
    def __init__(self, name, home_pos, size=(190, 80)):
        self.name = name
        self.w, self.h = size
        self.home_pos = list(home_pos)
        self.current_pos = [float(home_pos[0]), float(home_pos[1])]
        self.is_matched = False
        
        # Flight animation
        self.anim_target = None
        self.anim_speed = 0.22

    @property
    def rect(self):
        return pygame.Rect(int(self.current_pos[0]), int(self.current_pos[1]), self.w, self.h)

    @property
    def pin_pos(self):
        # Anchor pin on the left edge
        return (int(self.current_pos[0]), int(self.current_pos[1]) + self.h // 2)

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

    def draw(self, surface, is_hovered=False):
        r = self.rect
        fill = (255, 255, 255) if not is_hovered else (240, 248, 255)
        pygame.draw.rect(surface, fill, r, border_radius=14)
        border_col = (45, 185, 105) if self.is_matched else ((100, 160, 245) if is_hovered else (205, 215, 230))
        pygame.draw.rect(surface, border_col, r, 3 if is_hovered or self.is_matched else 2, border_radius=14)

        # Label Text
        txt = FONT_NAME.render(self.name, True, COLOR_TEXT)
        surface.blit(txt, txt.get_rect(center=(r.centerx + 10, r.centery)))

        # Left Pin Dot
        pin_col = (45, 185, 105) if self.is_matched else (70, 130, 240)
        pygame.draw.circle(surface, pin_col, self.pin_pos, 8)
        pygame.draw.circle(surface, (255, 255, 255), self.pin_pos, 4)


# ----------------- Positions Setup -----------------
def generate_column_points(count, x_pos, card_h=80):
    start_y = 115
    gap_y = 18
    return [(x_pos, start_y + i * (card_h + gap_y)) for i in range(count)]


def setup_game():
    data = list(FRUIT_CATALOG)
    count = len(data)

    fruit_pts = generate_column_points(count, 140)
    name_pts = generate_column_points(count, WIDTH - 140 - 190)

    # Independent shuffle of both sides
    shuffled_fruits = list(data)
    shuffled_names = list(data)
    random.shuffle(shuffled_fruits)
    random.shuffle(shuffled_names)

    fruit_cards = []
    for i, item in enumerate(shuffled_fruits):
        fruit_cards.append(FruitCard(item[0], item[1], item[2], fruit_pts[i]))

    name_cards = []
    for i, item in enumerate(shuffled_names):
        name_cards.append(NameCard(item[0], name_pts[i]))

    return fruit_cards, name_cards


def main():
    clock = pygame.time.Clock()

    fruit_cards, name_cards = setup_game()

    # Toolbar Buttons
    btn_scatter_fruits = Button((40, 25, 150, 42), "Scatter Fruits", COLOR_SCATTER_FRUIT)
    btn_scatter_names = Button((WIDTH - 360, 25, 150, 42), "Scatter Names", COLOR_SCATTER_NAME)
    btn_reset = Button((WIDTH - 170, 25, 130, 42), "Reset All", COLOR_RESET)

    # Active interaction state
    selected_fruit = None
    matched_pairs = [] # List of tuples: (fruit_card, name_card)

    running = True
    while running:
        clock.tick(60)
        mouse_pos = pygame.mouse.get_pos()

        # Update card positions during flight animations
        for f in fruit_cards:
            f.update()
        for n in name_cards:
            n.update()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                # Top Toolbar: Scatter Fruits
                if btn_scatter_fruits.is_clicked(mouse_pos):
                    SOUND_SCATTER.play()
                    pts = generate_column_points(len(fruit_cards), 140)
                    random.shuffle(pts)
                    for idx, f in enumerate(fruit_cards):
                        f.home_pos = list(pts[idx])
                        f.start_animation(f.home_pos)

                # Top Toolbar: Scatter Names
                elif btn_scatter_names.is_clicked(mouse_pos):
                    SOUND_SCATTER.play()
                    pts = generate_column_points(len(name_cards), WIDTH - 140 - 190)
                    random.shuffle(pts)
                    for idx, n in enumerate(name_cards):
                        n.home_pos = list(pts[idx])
                        n.start_animation(n.home_pos)

                # Top Toolbar: Reset
                elif btn_reset.is_clicked(mouse_pos):
                    SOUND_MISS.play()
                    matched_pairs.clear()
                    for f in fruit_cards:
                        f.is_matched = False
                    for n in name_cards:
                        n.is_matched = False

                # Start drawing line from an unmatched fruit
                for f in fruit_cards:
                    if not f.is_matched and f.rect.collidepoint(mouse_pos):
                        selected_fruit = f
                        SOUND_PICKUP.play()
                        break

            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                if selected_fruit:
                    match_found = False
                    for n in name_cards:
                        if not n.is_matched and n.rect.collidepoint(mouse_pos):
                            if n.name == selected_fruit.name:
                                # Successful match
                                selected_fruit.is_matched = True
                                n.is_matched = True
                                matched_pairs.append((selected_fruit, n))
                                SOUND_SUCCESS.play()
                                match_found = True
                            break

                    if not match_found:
                        # Miss or wrong name -> clear active line with soft wobble
                        SOUND_MISS.play()

                    selected_fruit = None

        # ----------------- Rendering -----------------
        SCREEN.fill(COLOR_BG)

        # Header Title & Buttons
        title = FONT_TITLE.render("Match each fruit to its name!", True, COLOR_TEXT)
        SCREEN.blit(title, title.get_rect(center=(WIDTH // 2, 45)))

        btn_scatter_fruits.draw(SCREEN)
        btn_scatter_names.draw(SCREEN)
        btn_reset.draw(SCREEN)

        # Draw Matched (Persistent) Connecting Lines
        for f, n in matched_pairs:
            start_xy = f.pin_pos
            end_xy = n.pin_pos
            pygame.draw.line(SCREEN, COLOR_LINE_MATCHED, start_xy, end_xy, 5)
            # Decorative joint caps
            pygame.draw.circle(SCREEN, COLOR_LINE_MATCHED, start_xy, 6)
            pygame.draw.circle(SCREEN, COLOR_LINE_MATCHED, end_xy, 6)

        # Draw Active Rubberband Line
        if selected_fruit:
            start_xy = selected_fruit.pin_pos
            pygame.draw.line(SCREEN, COLOR_LINE_ACTIVE, start_xy, mouse_pos, 4)
            pygame.draw.circle(SCREEN, COLOR_LINE_ACTIVE, mouse_pos, 6)

        # Draw Cards
        for f in fruit_cards:
            f.draw(SCREEN, is_selected=(f == selected_fruit))

        for n in name_cards:
            is_hover = (selected_fruit is not None and n.rect.collidepoint(mouse_pos))
            n.draw(SCREEN, is_hovered=is_hover)

        # Win State
        if len(matched_pairs) == len(fruit_cards):
            win_txt = FONT_TITLE.render("★ Super Job! All Fruits Matched! ★", True, (35, 170, 75))
            SCREEN.blit(win_txt, win_txt.get_rect(center=(WIDTH // 2, HEIGHT - 35)))

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()