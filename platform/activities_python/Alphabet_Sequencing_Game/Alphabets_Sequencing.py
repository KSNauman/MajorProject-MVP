import sys
import math
import array
import random
import pygame

# Initialize Pygame and Audio
pygame.init()
pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
pygame.font.init()

WIDTH, HEIGHT = 1200, 720
SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Alphabet Train - Blank Sequence Builder")

# Visual Palette
COLOR_BG = (246, 248, 252)
COLOR_TRAY = (236, 241, 248)
COLOR_TEXT = (45, 55, 72)
COLOR_PRIMARY = (70, 130, 240)
COLOR_ACTIVE = (45, 185, 105)
COLOR_SCATTER = (245, 155, 45)
COLOR_RESET = (235, 85, 85)

FONT_TITLE = pygame.font.SysFont("comicsansms", 26, bold=True)
FONT_BTN = pygame.font.SysFont("comicsansms", 17, bold=True)
FONT_LETTER = pygame.font.SysFont("comicsansms", 28, bold=True)
FONT_LETTER_SMALL = pygame.font.SysFont("comicsansms", 22, bold=True)

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


# ----------------- UI Elements -----------------
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


# ----------------- Alphabet Tile & Target Slot -----------------
BLOCK_COLORS = [
    (240, 95, 95),   # Coral Red
    (250, 155, 45),  # Orange
    (245, 200, 40),  # Yellow
    (60, 195, 110),  # Green
    (65, 155, 245),  # Blue
    (170, 90, 230),  # Purple
    (245, 115, 175), # Pink
]

class LetterTile:
    def __init__(self, letter, index, home_pos, size):
        self.letter = letter
        self.index = index
        self.size = size
        self.home_pos = list(home_pos)
        self.current_pos = [float(home_pos[0]), float(home_pos[1])]
        self.color = BLOCK_COLORS[index % len(BLOCK_COLORS)]
        
        self.is_placed = False
        self.is_dragging = False
        self.drag_offset = (0, 0)
        
        # Smooth flight animation attributes
        self.anim_target = None
        self.anim_speed = 0.20

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

    def draw(self, surface):
        # Shadow when dragging
        if self.is_dragging:
            shadow = pygame.Surface((self.size, self.size), pygame.SRCALPHA)
            pygame.draw.rect(shadow, (0, 0, 0, 35), (0, 0, self.size, self.size), border_radius=10)
            surface.blit(shadow, (int(self.current_pos[0]) + 5, int(self.current_pos[1]) + 6))

        # Main Block
        r = pygame.Rect(int(self.current_pos[0]), int(self.current_pos[1]), self.size, self.size)
        pygame.draw.rect(surface, self.color, r, border_radius=10)
        border_col = (255, 255, 255) if not self.is_placed else (40, 180, 80)
        pygame.draw.rect(surface, border_col, r, 3, border_radius=10)

        # Letter Text
        font = FONT_LETTER_SMALL if self.size < 60 else FONT_LETTER
        txt = font.render(self.letter, True, (255, 255, 255))
        surface.blit(txt, txt.get_rect(center=r.center))


class Slot:
    def __init__(self, letter, index, rect):
        self.letter = letter
        self.index = index
        self.rect = pygame.Rect(rect)
        self.occupied = False

    def draw(self, surface, is_hovered):
        # Clean blank target box (No ghost text inside)
        fill = (240, 245, 252) if not is_hovered else (225, 238, 255)
        pygame.draw.rect(surface, fill, self.rect, border_radius=10)
        border_col = (110, 160, 240) if is_hovered else (185, 200, 225)
        pygame.draw.rect(surface, border_col, self.rect, 2, border_radius=10)


# ----------------- Game Generator -----------------
ALL_LETTERS = [chr(i) for i in range(ord('A'), ord('Z') + 1)]

def calculate_shelf_points(letter_count, tile_size):
    tray_rect = pygame.Rect(50, 90, WIDTH - 100, 220)
    cols_tray = min(13, letter_count)
    col_spacing = (tray_rect.width - 50) // max(1, cols_tray - 1) if cols_tray > 1 else tray_rect.width // 2
    row_spacing = 75
    
    spawn_points = []
    rows_tray = math.ceil(letter_count / cols_tray)
    for r in range(rows_tray):
        for c in range(cols_tray):
            if len(spawn_points) < letter_count:
                px = tray_rect.x + 25 + c * col_spacing - (tile_size // 2)
                py = tray_rect.y + 25 + r * row_spacing
                spawn_points.append((px, py))
    return spawn_points

def setup_game(letter_count):
    letters = ALL_LETTERS[:letter_count]
    tile_size = 54 if letter_count > 12 else 68

    # Target sequence slots
    slots = []
    if letter_count <= 12:
        gap = 14
        total_w = letter_count * tile_size + (letter_count - 1) * gap
        start_x = (WIDTH - total_w) // 2
        y = HEIGHT - tile_size - 80

        for i, ch in enumerate(letters):
            x = start_x + i * (tile_size + gap)
            slots.append(Slot(ch, i, (x, y, tile_size, tile_size)))
    else:
        gap = 10
        cols = 13
        total_w = cols * tile_size + (cols - 1) * gap
        start_x = (WIDTH - total_w) // 2
        y1 = HEIGHT - 2 * tile_size - 80
        y2 = HEIGHT - tile_size - 50

        for i, ch in enumerate(letters):
            row = i // cols
            col = i % cols
            x = start_x + col * (tile_size + gap)
            y = y1 if row == 0 else y2
            slots.append(Slot(ch, i, (x, y, tile_size, tile_size)))

    spawn_points = calculate_shelf_points(letter_count, tile_size)
    random.shuffle(spawn_points)

    tiles = []
    for i, ch in enumerate(letters):
        tiles.append(LetterTile(ch, i, spawn_points[i], tile_size))

    random.shuffle(tiles)
    return tiles, slots


def main():
    clock = pygame.time.Clock()

    letter_counts = [5, 8, 12, 26]
    labels = ["A – E (5)", "A – H (8)", "A – L (12)", "A – Z (All)"]
    selected_count = 5

    # Top Toolbar Buttons
    buttons = [
        Button((40 + i * 140, 25, 130, 40), labels[i], COLOR_ACTIVE if letter_counts[i] == selected_count else COLOR_PRIMARY)
        for i in range(4)
    ]
    btn_scatter = Button((WIDTH - 260, 25, 110, 40), "Scatter", COLOR_SCATTER)
    btn_reset = Button((WIDTH - 140, 25, 100, 40), "Reset", COLOR_RESET)

    tiles, slots = setup_game(selected_count)
    dragged_tile = None

    running = True
    while running:
        clock.tick(60)
        mouse_pos = pygame.mouse.get_pos()

        # Update flight animations
        for tile in tiles:
            tile.update()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                # Mode Selection Buttons
                for i, btn in enumerate(buttons):
                    if btn.is_clicked(mouse_pos) and selected_count != letter_counts[i]:
                        selected_count = letter_counts[i]
                        for b in buttons: b.color = COLOR_PRIMARY
                        btn.color = COLOR_ACTIVE
                        tiles, slots = setup_game(selected_count)
                        break

                # Scatter Button: Re-shuffles new spots and glides them
                if btn_scatter.is_clicked(mouse_pos):
                    SOUND_SCATTER.play()
                    for slot in slots:
                        slot.occupied = False
                    
                    tile_size = tiles[0].size
                    new_points = calculate_shelf_points(len(tiles), tile_size)
                    random.shuffle(new_points)

                    for idx, tile in enumerate(tiles):
                        tile.is_placed = False
                        tile.home_pos = list(new_points[idx])
                        tile.start_animation(tile.home_pos)

                # Reset Button: Return smoothly to current home spots
                elif btn_reset.is_clicked(mouse_pos):
                    SOUND_BOUNCE.play()
                    for slot in slots:
                        slot.occupied = False
                    for tile in tiles:
                        tile.is_placed = False
                        tile.start_animation(tile.home_pos)

                # Pick up a tile (only if not currently flying or already placed)
                for tile in reversed(tiles):
                    if not tile.is_placed and tile.anim_target is None and tile.rect.collidepoint(mouse_pos):
                        dragged_tile = tile
                        tile.is_dragging = True
                        tile.drag_offset = (tile.current_pos[0] - mouse_pos[0], tile.current_pos[1] - mouse_pos[1])
                        SOUND_PICKUP.play()

                        # Layer to front
                        tiles.remove(tile)
                        tiles.append(tile)
                        break

            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                if dragged_tile:
                    dragged_tile.is_dragging = False
                    placed = False

                    # Check slot collision
                    for slot in slots:
                        if slot.rect.collidepoint(dragged_tile.rect.center):
                            # Must match the correct sequential slot and not be occupied
                            if slot.letter == dragged_tile.letter and not slot.occupied:
                                placed = True
                                dragged_tile.is_placed = True
                                dragged_tile.current_pos = [float(slot.rect.x), float(slot.rect.y)]
                                slot.occupied = True
                                SOUND_SUCCESS.play()
                            break

                    if not placed:
                        # Incorrect slot or out of sequence -> glide smoothly back to home shelf
                        dragged_tile.start_animation(dragged_tile.home_pos)
                        SOUND_BOUNCE.play()

                    dragged_tile = None

            elif event.type == pygame.MOUSEMOTION:
                if dragged_tile and dragged_tile.is_dragging:
                    dragged_tile.current_pos[0] = float(mouse_pos[0] + dragged_tile.drag_offset[0])
                    dragged_tile.current_pos[1] = float(mouse_pos[1] + dragged_tile.drag_offset[1])

        # ----------------- Rendering -----------------
        SCREEN.fill(COLOR_BG)

        # Header Buttons
        for btn in buttons:
            btn.draw(SCREEN)
        btn_scatter.draw(SCREEN)
        btn_reset.draw(SCREEN)

        # Tray Container (Scattered area)
        tray_rect = pygame.Rect(40, 85, WIDTH - 80, 235)
        pygame.draw.rect(SCREEN, COLOR_TRAY, tray_rect, border_radius=16)
        pygame.draw.rect(SCREEN, (215, 225, 238), tray_rect, 2, border_radius=16)

        # Target Blank Slots
        for slot in slots:
            is_hover = dragged_tile is not None and slot.rect.collidepoint(dragged_tile.rect.center)
            slot.draw(SCREEN, is_hover)

        # Alphabet Tiles
        for tile in tiles:
            tile.draw(SCREEN)

        # Victory Banner
        if all(t.is_placed for t in tiles):
            win_txt = FONT_TITLE.render("★ Wonderful! Sequence Complete! ★", True, (35, 170, 75))
            SCREEN.blit(win_txt, win_txt.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 10)))

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()