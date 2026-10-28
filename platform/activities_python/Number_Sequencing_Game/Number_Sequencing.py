import sys
import math
import array
import random
import pygame

# Initialize Pygame and Audio
pygame.init()
pygame.mixer.init(frequency=44100, size=-16, channels=1, buffer=512)
pygame.font.init()

WIDTH, HEIGHT = 1200, 740
SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Number Sequence Builder")

# Visual Palette
COLOR_BG = (246, 248, 252)
COLOR_TRAY = (236, 241, 248)
COLOR_TEXT = (45, 55, 72)
COLOR_PRIMARY = (70, 130, 240)
COLOR_ACTIVE_BORDER = (45, 125, 245)
COLOR_SCATTER = (245, 155, 45)
COLOR_RESET = (235, 85, 85)

FONT_TITLE = pygame.font.SysFont("comicsansms", 26, bold=True)
FONT_BTN = pygame.font.SysFont("comicsansms", 16, bold=True)
FONT_INPUT = pygame.font.SysFont("comicsansms", 18, bold=True)
FONT_NUM = pygame.font.SysFont("comicsansms", 26, bold=True)
FONT_NUM_SMALL = pygame.font.SysFont("comicsansms", 20, bold=True)

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


# ----------------- UI Buttons & Hybrid Input Control -----------------
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


class NumberInputField:
    """Supports both direct typing and +/- buttons."""
    def __init__(self, x, y, label, initial_val, min_val=1, max_val=99):
        self.x = x
        self.y = y
        self.label = label
        self.val = initial_val
        self.min_val = min_val
        self.max_val = max_val
        self.text_buffer = str(initial_val)
        self.is_focused = False

        self.box_rect = pygame.Rect(x + 75, y, 65, 36)
        self.btn_minus = Button((x + 148, y, 32, 36), "-", COLOR_PRIMARY)
        self.btn_plus = Button((x + 185, y, 32, 36), "+", COLOR_PRIMARY)

    def draw(self, surface):
        lbl = FONT_INPUT.render(self.label, True, COLOR_TEXT)
        surface.blit(lbl, (self.x, self.y + 6))

        # Input text box
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
        # Click on text box to focus
        if self.box_rect.collidepoint(pos):
            self.is_focused = True
            self.text_buffer = ""
            return False
        else:
            if self.is_focused:
                self.commit_text()
            self.is_focused = False

        # Button clicks
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
            # Allow up to 2-3 digits
            if len(self.text_buffer) < 3:
                self.text_buffer += event.unicode
            return False
        return False

    def commit_text(self):
        if self.text_buffer.strip():
            num = int(self.text_buffer)
            self.val = max(self.min_val, min(self.max_val, num))
        self.text_buffer = str(self.val)


# ----------------- Number Tiles & Target Slots -----------------
PALETTE = [
    (240, 95, 95),   # Coral Red
    (250, 155, 45),  # Orange
    (245, 200, 40),  # Yellow
    (60, 195, 110),  # Green
    (65, 155, 245),  # Blue
    (170, 90, 230),  # Purple
    (245, 115, 175), # Pink
    (50, 185, 185),  # Teal
]

class NumberTile:
    def __init__(self, number, color_idx, home_pos, size):
        self.number = number
        self.size = size
        self.home_pos = list(home_pos)
        self.current_pos = [float(home_pos[0]), float(home_pos[1])]
        self.color = PALETTE[color_idx % len(PALETTE)]
        
        self.is_placed = False
        self.is_dragging = False
        self.drag_offset = (0, 0)
        self.anim_target = None
        self.anim_speed = 0.22

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
        if self.is_dragging:
            shadow = pygame.Surface((self.size, self.size), pygame.SRCALPHA)
            pygame.draw.rect(shadow, (0, 0, 0, 35), (0, 0, self.size, self.size), border_radius=10)
            surface.blit(shadow, (int(self.current_pos[0]) + 5, int(self.current_pos[1]) + 6))

        r = pygame.Rect(int(self.current_pos[0]), int(self.current_pos[1]), self.size, self.size)
        pygame.draw.rect(surface, self.color, r, border_radius=10)
        border_col = (255, 255, 255) if not self.is_placed else (40, 180, 80)
        pygame.draw.rect(surface, border_col, r, 3, border_radius=10)

        font = FONT_NUM_SMALL if (self.size < 60 or self.number >= 100) else FONT_NUM
        txt = font.render(str(self.number), True, (255, 255, 255))
        surface.blit(txt, txt.get_rect(center=r.center))


class Slot:
    def __init__(self, number, rect):
        self.number = number
        self.rect = pygame.Rect(rect)
        self.occupied = False

    def draw(self, surface, is_hovered):
        fill = (240, 245, 252) if not is_hovered else (225, 238, 255)
        pygame.draw.rect(surface, fill, self.rect, border_radius=10)
        border_col = (110, 160, 240) if is_hovered else (185, 200, 225)
        pygame.draw.rect(surface, border_col, self.rect, 2, border_radius=10)


# ----------------- Game Generator -----------------
def calculate_shelf_points(count, tile_size):
    tray_rect = pygame.Rect(50, 100, WIDTH - 100, 230)
    cols_tray = min(11, count)
    col_spacing = (tray_rect.width - 50) // max(1, cols_tray - 1) if cols_tray > 1 else tray_rect.width // 2
    row_spacing = 75
    
    spawn_points = []
    rows_tray = math.ceil(count / cols_tray)
    for r in range(rows_tray):
        for c in range(cols_tray):
            if len(spawn_points) < count:
                px = tray_rect.x + 25 + c * col_spacing - (tile_size // 2)
                py = tray_rect.y + 25 + r * row_spacing
                spawn_points.append((px, py))
    return spawn_points

def setup_game(start_num, end_num):
    numbers = list(range(start_num, end_num + 1))
    count = len(numbers)
    tile_size = 54 if count > 10 else 66

    slots = []
    if count <= 10:
        gap = 14
        total_w = count * tile_size + (count - 1) * gap
        start_x = (WIDTH - total_w) // 2
        y = HEIGHT - tile_size - 75

        for i, num in enumerate(numbers):
            x = start_x + i * (tile_size + gap)
            slots.append(Slot(num, (x, y, tile_size, tile_size)))
    else:
        gap = 10
        cols = math.ceil(count / 2)
        total_w = cols * tile_size + (cols - 1) * gap
        start_x = (WIDTH - total_w) // 2
        y1 = HEIGHT - 2 * tile_size - 85
        y2 = HEIGHT - tile_size - 50

        for i, num in enumerate(numbers):
            row = i // cols
            col = i % cols
            x = start_x + col * (tile_size + gap)
            y = y1 if row == 0 else y2
            slots.append(Slot(num, (x, y, tile_size, tile_size)))

    spawn_points = calculate_shelf_points(count, tile_size)
    random.shuffle(spawn_points)

    tiles = []
    for i, num in enumerate(numbers):
        tiles.append(NumberTile(num, i, spawn_points[i], tile_size))

    random.shuffle(tiles)
    return tiles, slots


def main():
    clock = pygame.time.Clock()

    start_input = NumberInputField(50, 26, "Start:", initial_val=1, min_val=1, max_val=90)
    end_input = NumberInputField(310, 26, "End:", initial_val=6, min_val=2, max_val=99)

    btn_scatter = Button((WIDTH - 245, 24, 105, 40), "Scatter", COLOR_SCATTER)
    btn_reset = Button((WIDTH - 130, 24, 90, 40), "Reset", COLOR_RESET)

    tiles, slots = setup_game(start_input.val, end_input.val)
    dragged_tile = None

    def refresh_range():
        if end_input.val < start_input.val:
            end_input.val = start_input.val
            end_input.text_buffer = str(end_input.val)
        if (end_input.val - start_input.val + 1) > 20:
            end_input.val = start_input.val + 19
            end_input.text_buffer = str(end_input.val)
        return setup_game(start_input.val, end_input.val)

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

            elif event.type == pygame.KEYDOWN:
                # Direct keyboard input for whichever field is active
                changed_start = start_input.handle_key(event)
                changed_end = end_input.handle_key(event)
                if changed_start or changed_end:
                    tiles, slots = refresh_range()

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                # Handle inputs / buttons click
                c1 = start_input.handle_click(mouse_pos)
                c2 = end_input.handle_click(mouse_pos)
                if c1 or c2:
                    tiles, slots = refresh_range()

                # Scatter Button
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

                # Reset Button
                elif btn_reset.is_clicked(mouse_pos):
                    SOUND_BOUNCE.play()
                    for slot in slots:
                        slot.occupied = False
                    for tile in tiles:
                        tile.is_placed = False
                        tile.start_animation(tile.home_pos)

                # Pick up a tile
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
                            # Must match correct sequential slot and not be occupied
                            if slot.number == dragged_tile.number and not slot.occupied:
                                placed = True
                                dragged_tile.is_placed = True
                                dragged_tile.current_pos = [float(slot.rect.x), float(slot.rect.y)]
                                slot.occupied = True
                                SOUND_SUCCESS.play()
                            break

                    if not placed:
                        # Incorrect slot or out of sequence -> glide smoothly back
                        dragged_tile.start_animation(dragged_tile.home_pos)
                        SOUND_BOUNCE.play()

                    dragged_tile = None

            elif event.type == pygame.MOUSEMOTION:
                if dragged_tile and dragged_tile.is_dragging:
                    dragged_tile.current_pos[0] = float(mouse_pos[0] + dragged_tile.drag_offset[0])
                    dragged_tile.current_pos[1] = float(mouse_pos[1] + dragged_tile.drag_offset[1])

        # ----------------- Rendering -----------------
        SCREEN.fill(COLOR_BG)

        # Header Toolbar
        start_input.draw(SCREEN)
        end_input.draw(SCREEN)
        btn_scatter.draw(SCREEN)
        btn_reset.draw(SCREEN)

        # Tray Container (Scattered area)
        tray_rect = pygame.Rect(40, 85, WIDTH - 80, 245)
        pygame.draw.rect(SCREEN, COLOR_TRAY, tray_rect, border_radius=16)
        pygame.draw.rect(SCREEN, (215, 225, 238), tray_rect, 2, border_radius=16)

        # Target Blank Slots
        for slot in slots:
            is_hover = dragged_tile is not None and slot.rect.collidepoint(dragged_tile.rect.center)
            slot.draw(SCREEN, is_hover)

        # Number Tiles
        for tile in tiles:
            tile.draw(SCREEN)

        # Win State
        if all(t.is_placed for t in tiles):
            win_txt = FONT_TITLE.render("★ Great Counting! All Numbers in Order! ★", True, (35, 170, 75))
            SCREEN.blit(win_txt, win_txt.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 15)))

        pygame.display.flip()

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()