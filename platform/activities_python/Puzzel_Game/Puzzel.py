import os
import random
import cv2
import pygame
from tkinter import Tk, filedialog

pygame.init()
pygame.font.init()

# Window Setup
WIDTH, HEIGHT = 1100, 650
SCREEN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Kindergarten Puzzle Builder")

# Visual Styling
COLOR_BG = (245, 247, 250)
COLOR_PANEL = (225, 230, 240)
COLOR_GRID = (180, 190, 205)
COLOR_PRIMARY = (70, 130, 240)
COLOR_ACCENT = (50, 200, 120)
COLOR_TEXT = (40, 45, 60)

FONT_TITLE = pygame.font.SysFont("comicsansms", 28, bold=True)
FONT_BTN = pygame.font.SysFont("comicsansms", 20, bold=True)


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


class PuzzlePiece:
    def __init__(self, image, target_pos, tray_pos, size):
        self.image = image
        self.target_pos = target_pos      # Correct target (x, y)
        self.tray_pos = tray_pos          # Home shelf (x, y)
        self.current_pos = list(tray_pos) # Current render (x, y)
        self.size = size
        self.is_placed = False
        self.is_dragging = False
        self.drag_offset = (0, 0)

    @property
    def rect(self):
        return pygame.Rect(self.current_pos[0], self.current_pos[1], self.size, self.size)

    def draw(self, surface):
        surface.blit(self.image, self.current_pos)
        border_col = (50, 200, 100) if self.is_placed else (255, 255, 255)
        border_width = 3 if self.is_placed else 2
        pygame.draw.rect(surface, border_col, self.rect, border_width)


def get_image_from_file():
    root = Tk()
    root.withdraw()
    path = filedialog.askopenfilename(filetypes=[("Image files", "*.jpg;*.jpeg;*.png;*.bmp")])
    root.destroy()
    return pygame.image.load(path) if path else None


def capture_image_from_camera():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        return None

    captured_surface = None
    clock = pygame.time.Clock()
    
    running = True
    while running:
        clock.tick(30)
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape
        min_dim = min(h, w)
        start_x, start_y = (w - min_dim) // 2, (h - min_dim) // 2
        square_crop = frame[start_y:start_y + min_dim, start_x:start_x + min_dim]

        rgb = cv2.cvtColor(square_crop, cv2.COLOR_BGR2RGB)
        surf = pygame.image.frombuffer(rgb.tobytes(), (min_dim, min_dim), 'RGB')
        surf = pygame.transform.scale(surf, (400, 400))

        SCREEN.fill(COLOR_BG)
        title = FONT_TITLE.render("Center your smile and press SPACE to capture!", True, COLOR_TEXT)
        SCREEN.blit(title, title.get_rect(center=(WIDTH // 2, 60)))
        SCREEN.blit(surf, (WIDTH // 2 - 200, 120))
        pygame.display.flip()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    captured_surface = surf
                    running = False
                elif event.key == pygame.K_ESCAPE:
                    running = False

    cap.release()
    return captured_surface


def setup_game_pieces(raw_surf, grid_n):
    board_size = 440
    scaled_full = pygame.transform.smoothscale(raw_surf, (board_size, board_size))
    
    board_origin = (60, 110)
    piece_size = board_size // grid_n
    snap_box_size = piece_size

    # Ghost background for left board
    ghost = scaled_full.copy()
    ghost.set_alpha(80)

    # Tray layout (Right Panel)
    tray_origin_x = 570
    tray_origin_y = 110
    tray_cols = min(grid_n, 3)

    # Generate piece slots
    tray_slots = []
    slot_gap = 12
    for r in range(grid_n * 2):
        for c in range(tray_cols):
            tx = tray_origin_x + c * (piece_size + slot_gap)
            ty = tray_origin_y + r * (piece_size + slot_gap)
            if tx + piece_size <= WIDTH - 20 and ty + piece_size <= HEIGHT - 30:
                tray_slots.append((tx, ty))

    random.shuffle(tray_slots)

    pieces = []
    slot_idx = 0
    for row in range(grid_n):
        for col in range(grid_n):
            src_x = col * piece_size
            src_y = row * piece_size
            
            piece_img = pygame.Surface((piece_size, piece_size))
            piece_img.blit(scaled_full, (0, 0), (src_x, src_y, piece_size, piece_size))

            target_x = board_origin[0] + src_x
            target_y = board_origin[1] + src_y
            tray_xy = tray_slots[slot_idx] if slot_idx < len(tray_slots) else (tray_origin_x, tray_origin_y)
            slot_idx += 1

            pieces.append(PuzzlePiece(piece_img, (target_x, target_y), tray_xy, piece_size))

    return pieces, ghost, board_origin, board_size


def run_puzzle_session():
    clock = pygame.time.Clock()
    
    # State flags
    grid_n = 2
    active_img = None
    pieces = []
    ghost_surf = None
    board_origin = (60, 110)
    board_size = 440
    dragged_piece = None

    # Buttons
    btn_upload = Button((50, 20, 130, 45), "Upload File")
    btn_camera = Button((190, 20, 130, 45), "Webcam Snap")
    btn_2x2 = Button((740, 20, 90, 45), "2 x 2", COLOR_ACCENT)
    btn_3x3 = Button((840, 20, 90, 45), "3 x 3")
    btn_4x4 = Button((940, 20, 90, 45), "4 x 4")

    # Default starter image (fallback colored canvas)
    default_surf = pygame.Surface((440, 440))
    default_surf.fill((255, 170, 70))
    pygame.draw.circle(default_surf, (80, 180, 255), (220, 220), 120)
    pygame.draw.rect(default_surf, (240, 90, 90), (160, 160, 120, 120))
    active_img = default_surf
    pieces, ghost_surf, board_origin, board_size = setup_game_pieces(active_img, grid_n)

    running = True
    while running:
        clock.tick(60)
        mouse_pos = pygame.mouse.get_pos()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                # Top Toolbar Clicks
                if btn_upload.is_clicked(mouse_pos):
                    loaded = get_image_from_file()
                    if loaded:
                        active_img = loaded
                        pieces, ghost_surf, board_origin, board_size = setup_game_pieces(active_img, grid_n)
                elif btn_camera.is_clicked(mouse_pos):
                    snapped = capture_image_from_camera()
                    if snapped:
                        active_img = snapped
                        pieces, ghost_surf, board_origin, board_size = setup_game_pieces(active_img, grid_n)
                elif btn_2x2.is_clicked(mouse_pos):
                    grid_n = 2
                    btn_2x2.color, btn_3x3.color, btn_4x4.color = COLOR_ACCENT, COLOR_PRIMARY, COLOR_PRIMARY
                    pieces, ghost_surf, board_origin, board_size = setup_game_pieces(active_img, grid_n)
                elif btn_3x3.is_clicked(mouse_pos):
                    grid_n = 3
                    btn_2x2.color, btn_3x3.color, btn_4x4.color = COLOR_PRIMARY, COLOR_ACCENT, COLOR_PRIMARY
                    pieces, ghost_surf, board_origin, board_size = setup_game_pieces(active_img, grid_n)
                elif btn_4x4.is_clicked(mouse_pos):
                    grid_n = 4
                    btn_2x2.color, btn_3x3.color, btn_4x4.color = COLOR_PRIMARY, COLOR_PRIMARY, COLOR_ACCENT
                    pieces, ghost_surf, board_origin, board_size = setup_game_pieces(active_img, grid_n)

                # Piece Drag Start (reverse iteration picks the top-rendered piece)
                for piece in reversed(pieces):
                    if not piece.is_placed and piece.rect.collidepoint(mouse_pos):
                        dragged_piece = piece
                        piece.is_dragging = True
                        piece.drag_offset = (piece.current_pos[0] - mouse_pos[0], piece.current_pos[1] - mouse_pos[1])
                        # Move to end so it renders above other pieces
                        pieces.remove(piece)
                        pieces.append(piece)
                        break

            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                if dragged_piece:
                    dragged_piece.is_dragging = False
                    
                    # Generous Snap Window (35% tolerance)
                    snap_threshold = dragged_piece.size * 0.40
                    target_x, target_y = dragged_piece.target_pos
                    curr_x, curr_y = dragged_piece.current_pos

                    dist = ((curr_x - target_x) ** 2 + (curr_y - target_y) ** 2) ** 0.5
                    if dist <= snap_threshold:
                        dragged_piece.current_pos = [target_x, target_y]
                        dragged_piece.is_placed = True
                    else:
                        # Spring back to Tray
                        dragged_piece.current_pos = list(dragged_piece.tray_pos)
                    
                    dragged_piece = None

            elif event.type == pygame.MOUSEMOTION:
                if dragged_piece and dragged_piece.is_dragging:
                    dragged_piece.current_pos[0] = mouse_pos[0] + dragged_piece.drag_offset[0]
                    dragged_piece.current_pos[1] = mouse_pos[1] + dragged_piece.drag_offset[1]

        # ---------------- Render Loop ----------------
        SCREEN.fill(COLOR_BG)

        # Draw Controls
        btn_upload.draw(SCREEN)
        btn_camera.draw(SCREEN)
        btn_2x2.draw(SCREEN)
        btn_3x3.draw(SCREEN)
        btn_4x4.draw(SCREEN)

        # Draw Left Grid Slot Outlines
        pygame.draw.rect(SCREEN, (255, 255, 255), (board_origin[0], board_origin[1], board_size, board_size))
        SCREEN.blit(ghost_surf, board_origin)
        pygame.draw.rect(SCREEN, COLOR_GRID, (board_origin[0], board_origin[1], board_size, board_size), 3)

        cell_step = board_size // grid_n
        for idx in range(1, grid_n):
            pygame.draw.line(SCREEN, COLOR_GRID, (board_origin[0] + idx * cell_step, board_origin[1]), 
                             (board_origin[0] + idx * cell_step, board_origin[1] + board_size), 2)
            pygame.draw.line(SCREEN, COLOR_GRID, (board_origin[0], board_origin[1] + idx * cell_step), 
                             (board_origin[0] + board_size, board_origin[1] + idx * cell_step), 2)

        # Draw Right Tray Region
        tray_rect = pygame.Rect(540, 95, WIDTH - 560, HEIGHT - 115)
        pygame.draw.rect(SCREEN, COLOR_PANEL, tray_rect, border_radius=15)
        pygame.draw.rect(SCREEN, (210, 218, 230), tray_rect, 2, border_radius=15)

        # Draw Puzzle Pieces
        for piece in pieces:
            piece.draw(SCREEN)

        # Completion Status
        if all(p.is_placed for p in pieces):
            celebrate = FONT_TITLE.render("Great Job! Puzzle Solved!", True, (30, 160, 60))
            SCREEN.blit(celebrate, celebrate.get_rect(center=(WIDTH // 2, HEIGHT - 25)))

        pygame.display.flip()

    pygame.quit()


if __name__ == "__main__":
    run_puzzle_session()