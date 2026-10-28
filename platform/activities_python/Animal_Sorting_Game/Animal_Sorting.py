import sys
import math
import array
import random
import pygame

pygame.init()
pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
pygame.font.init()

WIDTH, HEIGHT = 1200, 750
SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Animal Habitat Sorter - Land, Water & Sky")

# Visual Palette
COLOR_BG = (246, 248, 252)
COLOR_SHELF = (236, 241, 248)
COLOR_TEXT = (45, 55, 72)
COLOR_PRIMARY = (70, 130, 240)
COLOR_ACTIVE = (45, 185, 105)
COLOR_SCATTER = (245, 155, 45)
COLOR_RESET = (235, 85, 85)

# Fonts (Comic Sans for text, Segoe UI Emoji for animal faces on Windows)
FONT_TITLE = pygame.font.SysFont("comicsansms", 26, bold=True)
FONT_BTN = pygame.font.SysFont("comicsansms", 16, bold=True)
FONT_LABEL = pygame.font.SysFont("comicsansms", 13, bold=True)
FONT_HABITAT = pygame.font.SysFont("comicsansms", 22, bold=True)
FONT_EMOJI = pygame.font.SysFont(["segoeuiemoji", "applecoloremoji", "notocoloremoji", "comicsansms"], 36)

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
SOUND_BOUNCE = generate_soft_bounce()
SOUND_SCATTER = generate_whoosh()


# ----------------- Habitat Configs -----------------
HABITAT_CONFIGS = [
    {
        "name": "Land",
        "title": "🌲 Land Animals",
        "color": (55, 175, 95),
        "tint": (230, 250, 235),
    },
    {
        "name": "Water",
        "title": "🌊 Ocean / Water",
        "color": (45, 135, 245),
        "tint": (228, 242, 255),
    },
    {
        "name": "Sky",
        "title": "☁️ Sky / Birds",
        "color": (155, 85, 235),
        "tint": (245, 235, 255),
    },
]

# Animal Catalog: (Name, Habitat, Emoji, Background Card Color)
ANIMAL_CATALOG = [
    # Land
    ("Lion", "Land", "🦁", (255, 220, 160)),
    ("Elephant", "Land", "🐘", (220, 225, 235)),
    ("Monkey", "Land", "🐵", (245, 205, 165)),
    ("Bear", "Land", "🐻", (230, 195, 165)),
    # Water
    ("Fish", "Water", "🐟", (195, 230, 255)),
    ("Whale", "Water", "🐋", (185, 215, 255)),
    ("Octopus", "Water", "🐙", (255, 210, 230)),
    ("Crab", "Water", "🦀", (255, 200, 195)),
    # Sky
    ("Eagle", "Sky", "🦅", (235, 220, 210)),
    ("Parrot", "Sky", "🦜", (210, 245, 215)),
    ("Butterfly", "Sky", "🦋", (245, 215, 255)),
    ("Bat", "Sky", "🦇", (220, 220, 235)),
]


# ----------------- UI Buttons & Entities -----------------
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


class HabitatZone:
    def __init__(self, rect, cfg):
        self.rect = pygame.Rect(rect)
        self.name = cfg["name"]
        self.title = cfg["title"]
        self.color = cfg["color"]
        self.tint = cfg["tint"]
        self.placed_animals = []

    def get_next_slot(self, animal_w, animal_h):
        """Calculates arranged grid slots inside the habitat."""
        idx = len(self.placed_animals)
        cols = 3
        col = idx % cols
        row = idx // cols

        pad_x = 22
        pad_y = 52
        gap_x = 18
        gap_y = 14

        x = self.rect.x + pad_x + col * (animal_w + gap_x)
        y = self.rect.y + pad_y + row * (animal_h + gap_y)
        return [x, y]

    def draw(self, surface, is_hovered):
        fill = self.tint if is_hovered else (255, 255, 255)
        pygame.draw.rect(surface, fill, self.rect, border_radius=16)
        pygame.draw.rect(surface, self.color, self.rect, 4, border_radius=16)

        # Header Title Bar
        header_rect = pygame.Rect(self.rect.x, self.rect.y, self.rect.width, 38)
        pygame.draw.rect(surface, self.color, header_rect, border_top_left_radius=14, border_top_right_radius=14)

        title_txt = FONT_HABITAT.render(self.title, True, (255, 255, 255))
        surface.blit(title_txt, title_txt.get_rect(center=header_rect.center))


class AnimalCard:
    def __init__(self, name, habitat, emoji, card_col, home_pos, size=(75, 75)):
        self.name = name
        self.habitat = habitat
        self.emoji = emoji
        self.card_col = card_col
        self.w, self.h = size
        self.home_pos = list(home_pos)
        self.current_pos = [float(home_pos[0]), float(home_pos[1])]

        self.is_placed = False
        self.is_dragging = False
        self.drag_offset = (0, 0)
        self.anim_target = None
        self.anim_speed = 0.22

        self.surf = self.render_card()

    def render_card(self):
        surf = pygame.Surface((self.w, self.h), pygame.SRCALPHA)
        pygame.draw.rect(surf, self.card_col, (0, 0, self.w, self.h), border_radius=12)
        pygame.draw.rect(surf, (255, 255, 255), (0, 0, self.w, self.h), 2, border_radius=12)

        # Render emoji icon
        emoji_txt = FONT_EMOJI.render(self.emoji, True, (0, 0, 0))
        surf.blit(emoji_txt, emoji_txt.get_rect(center=(self.w // 2, self.h // 2 - 8)))

        # Subtitle Name
        name_txt = FONT_LABEL.render(self.name, True, COLOR_TEXT)
        surf.blit(name_txt, name_txt.get_rect(center=(self.w // 2, self.h - 14)))
        return surf

    @property
    def rect(self):
        return pygame.Rect(int(self.current_pos[0]), int(self.current_pos[1]), self.w, self.h)

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
        if self.is_dragging:
            shadow = pygame.Surface((self.w, self.h), pygame.SRCALPHA)
            pygame.draw.rect(shadow, (0, 0, 0, 35), (0, 0, self.w, self.h), border_radius=12)
            surface.blit(shadow, (int(self.current_pos[0]) + 5, int(self.current_pos[1]) + 6))

        surface.blit(self.surf, (int(self.current_pos[0]), int(self.current_pos[1])))


# ----------------- Game Setup & Distribution -----------------
def calculate_shelf_points(count, card_w):
    shelf_rect = pygame.Rect(40, 90, WIDTH - 80, 175)
    cols = min(6, count)
    rows = math.ceil(count / cols)

    col_gap = (shelf_rect.width - 40) // cols
    row_gap = 80

    points = []
    for r in range(rows):
        for c in range(cols):
            if len(points) < count:
                px = shelf_rect.x + 25 + c * col_gap + (col_gap - card_w) // 2
                py = shelf_rect.y + 16 + r * row_gap
                points.append((px, py))
    return points

def setup_game(count):
    # Select balanced representation across the 3 habitats
    land = [a for a in ANIMAL_CATALOG if a[1] == "Land"]
    water = [a for a in ANIMAL_CATALOG if a[1] == "Water"]
    sky = [a for a in ANIMAL_CATALOG if a[1] == "Sky"]

    per_group = count // 3
    chosen = random.sample(land, per_group) + random.sample(water, per_group) + random.sample(sky, per_group)
    random.shuffle(chosen)

    card_size = (78, 72)
    shelf_pts = calculate_shelf_points(count, card_size[0])
    random.shuffle(shelf_pts)

    animals = []
    for i, item in enumerate(chosen):
        animals.append(AnimalCard(item[0], item[1], item[2], item[3], shelf_pts[i], size=card_size))

    return animals


def main():
    clock = pygame.time.Clock()

    # Create 3 Habitat Zones across bottom
    habitats = []
    zone_w = 360
    zone_h = 370
    zone_y = HEIGHT - zone_h - 30
    gap = (WIDTH - (3 * zone_w)) // 4

    for i, cfg in enumerate(HABITAT_CONFIGS):
        zx = gap + i * (zone_w + gap)
        habitats.append(HabitatZone((zx, zone_y, zone_w, zone_h), cfg))

    # Controls
    selected_count = 6
    btn_6 = Button((50, 25, 110, 40), "6 Animals", COLOR_ACTIVE)
    btn_12 = Button((170, 25, 115, 40), "12 Animals", COLOR_PRIMARY)

    btn_scatter = Button((WIDTH - 250, 25, 105, 40), "Scatter", COLOR_SCATTER)
    btn_reset = Button((WIDTH - 135, 25, 95, 40), "Reset", COLOR_RESET)

    animals = setup_game(selected_count)
    dragged_animal = None

    running = True
    while running:
        clock.tick(60)
        mouse_pos = pygame.mouse.get_pos()

        # Update animations
        for animal in animals:
            animal.update()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                # Count selection
                if btn_6.is_clicked(mouse_pos) and selected_count != 6:
                    selected_count = 6
                    btn_6.color, btn_12.color = COLOR_ACTIVE, COLOR_PRIMARY
                    for h in habitats: h.placed_animals.clear()
                    animals = setup_game(selected_count)

                elif btn_12.is_clicked(mouse_pos) and selected_count != 12:
                    selected_count = 12
                    btn_6.color, btn_12.color = COLOR_PRIMARY, COLOR_ACTIVE
                    for h in habitats: h.placed_animals.clear()
                    animals = setup_game(selected_count)

                # Scatter Button
                elif btn_scatter.is_clicked(mouse_pos):
                    SOUND_SCATTER.play()
                    for h in habitats:
                        h.placed_animals.clear()
                    new_pts = calculate_shelf_points(len(animals), animals[0].w)
                    random.shuffle(new_pts)
                    for idx, a in enumerate(animals):
                        a.is_placed = False
                        a.home_pos = list(new_pts[idx])
                        a.start_animation(a.home_pos)

                # Reset Button
                elif btn_reset.is_clicked(mouse_pos):
                    SOUND_BOUNCE.play()
                    for h in habitats:
                        h.placed_animals.clear()
                    for a in animals:
                        a.is_placed = False
                        a.start_animation(a.home_pos)

                # Pick up an animal card
                for a in reversed(animals):
                    if not a.is_placed and a.anim_target is None and a.rect.collidepoint(mouse_pos):
                        dragged_animal = a
                        a.is_dragging = True
                        a.drag_offset = (a.current_pos[0] - mouse_pos[0], a.current_pos[1] - mouse_pos[1])
                        SOUND_PICKUP.play()

                        # Move to render top
                        animals.remove(a)
                        animals.append(a)
                        break

            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                if dragged_animal:
                    dragged_animal.is_dragging = False
                    placed = False

                    for h in habitats:
                        if h.rect.collidepoint(dragged_animal.rect.center):
                            if h.name == dragged_animal.habitat:
                                placed = True
                                dragged_animal.is_placed = True
                                target_xy = h.get_next_slot(dragged_animal.w, dragged_animal.h)
                                dragged_animal.start_animation(target_xy)
                                h.placed_animals.append(dragged_animal)
                                SOUND_SUCCESS.play()
                            break

                    if not placed:
                        # Wrong habitat or dropped outside -> bounce back to shelf
                        dragged_animal.start_animation(dragged_animal.home_pos)
                        SOUND_BOUNCE.play()

                    dragged_animal = None

            elif event.type == pygame.MOUSEMOTION:
                if dragged_animal and dragged_animal.is_dragging:
                    dragged_animal.current_pos[0] = float(mouse_pos[0] + dragged_animal.drag_offset[0])
                    dragged_animal.current_pos[1] = float(mouse_pos[1] + dragged_animal.drag_offset[1])

        # ----------------- Rendering -----------------
        SCREEN.fill(COLOR_BG)

        # Header Title & Buttons
        title = FONT_TITLE.render("Where do these animals live?", True, COLOR_TEXT)
        SCREEN.blit(title, title.get_rect(center=(WIDTH // 2, 45)))

        btn_6.draw(SCREEN)
        btn_12.draw(SCREEN)
        btn_scatter.draw(SCREEN)
        btn_reset.draw(SCREEN)

        # Top Shelf Tray
        shelf_rect = pygame.Rect(40, 85, WIDTH - 80, 180)
        pygame.draw.rect(SCREEN, COLOR_SHELF, shelf_rect, border_radius=16)
        pygame.draw.rect(SCREEN, (215, 225, 238), shelf_rect, 2, border_radius=16)

        # Draw Habitat Zones
        for h in habitats:
            is_hover = dragged_animal is not None and h.rect.collidepoint(dragged_animal.rect.center)
            h.draw(SCREEN, is_hover)

        # Draw Animals
        for a in animals:
            a.draw(SCREEN)

        # Win State
        if all(a.is_placed for a in animals):
            win_txt = FONT_TITLE.render("★ Great Job! All Animals Are Home! ★", True, (35, 170, 75))
            SCREEN.blit(win_txt, win_txt.get_rect(center=(WIDTH // 2, 85 + 90)))

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()