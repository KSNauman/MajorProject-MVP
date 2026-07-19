export interface DemoDrawing {
  name: string;
  classification: string;
  motionProfile: "swim" | "fly" | "launch" | "bounce";
  hint: string;
  // Compact minimalist vector base64 images that look like children's hand-drawn crayon sketches
  imageBase64: string; 
}

// 4 high-quality cute crayon doodles represented in lightweight SVGs encoded in Base64
export const DEMO_DRAWINGS: DemoDrawing[] = [
  {
    name: "Finny the Blue Whale",
    classification: "Cheerful Whale",
    motionProfile: "swim",
    hint: "Perfect for testing under-the-sea marine environments and swimmable lateral motion paths.",
    imageBase64: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' width='400' height='400'><style>.crayon{stroke:%230066cc;stroke-width:12;stroke-linecap:round;stroke-linejoin:round;fill:%234da6ff;fill-opacity:0.6;}.detail{stroke:%23003366;stroke-width:6;fill:none;}.eye{fill:%23000000;}</style><rect width='100%25' height='100%25' fill='%23fbf9e6'/><path class='crayon' d='M 80 180 C 120 100, 260 100, 310 170 C 350 160, 380 130, 380 150 C 380 180, 340 220, 310 210 C 290 260, 210 270, 160 260 C 100 250, 70 210, 80 180 Z'/><path class='crayon' d='M 230 240 C 230 290, 190 310, 180 300 C 180 270, 210 250, 230 240 Z'/><path class='crayon' d='M 210 130 C 180 80, 160 60, 150 70 C 160 90, 190 120, 210 130 Z'/><circle cx='160' cy='160' r='14' fill='%23ffffff' stroke='%23001f3f' stroke-width='4'/><circle cx='163' cy='157' r='6' class='eye'/><path class='detail' d='M 120 200 C 140 220, 180 220, 200 190'/><path class='detail' d='M 110 230 Q 150 250 200 230'/><circle cx='210' cy='60' r='8' fill='%23ffffff' stroke='%230088cc' stroke-width='4'/><circle cx='230' cy='40' r='6' fill='%23ffffff' stroke='%230088cc' stroke-width='3'/></svg>"
  },
  {
    name: "Cosmo the Space Rocket",
    classification: "Magical Rocketship",
    motionProfile: "launch",
    hint: "Perfect for space launch shaking animations and upward vertical acceleration trials.",
    imageBase64: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' width='400' height='400'><style>.hull{stroke:%23cc3300;stroke-width:12;stroke-linecap:round;stroke-linejoin:round;fill:%23ff6666;fill-opacity:0.7;}.fin{fill:%23990000;stroke:%23660000;stroke-width:8;}.window{fill:%2399ffff;stroke:%23006666;stroke-width:8;}.fire{fill:%23ffcc00;stroke:%23ff3300;stroke-width:10;}</style><rect width='100%25' height='100%25' fill='%23fbf9e6'/><path class='fire' d='M 160 280 L 200 370 L 240 280 C 220 300, 180 300, 160 280 Z'/><path class='hull' d='M 150 280 Q 200 60 250 280 Z'/><path class='fin' d='M 150 230 L 100 280 L 150 280 Z'/><path class='fin' d='M 250 230 L 300 280 L 250 280 Z'/><circle class='window' cx='200' cy='170' r='25'/><circle cx='200' cy='170' r='12' fill='%2333ccff'/></svg>"
  },
  {
    name: "Steggy Dino",
    classification: "Friendly Stegosaurus",
    motionProfile: "bounce",
    hint: "Perfect for testing terrestrial layouts, interactive grasslands, and heavy bouncing motion profiles.",
    imageBase64: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' width='400' height='400'><style>.body{stroke:%23008000;stroke-width:12;stroke-linecap:round;stroke-linejoin:round;fill:%2332cd32;fill-opacity:0.6;}.plate{fill:%23ff9900;stroke:%23cc6600;stroke-width:8;}.eye{fill:%23000000;}</style><rect width='100%25' height='100%25' fill='%23fbf9e6'/><polygon class='plate' points='150,130 170,90 190,130'/><polygon class='plate' points='190,120 215,75 240,120'/><polygon class='plate' points='240,125 260,85 280,125'/><polygon class='plate' points='285,140 310,100 325,150'/><path class='body' d='M 100 240 Q 90 140 180 130 C 220 120, 290 130, 310 160 Q 350 180, 370 170 Q 350 210, 310 210 Q 280 250, 220 250 C 160 250, 110 250, 100 240 Z'/><rect class='body' x='130' y='245' width='25' height='60' rx='5'/><rect class='body' x='230' y='245' width='25' height='60' rx='5'/><circle cx='130' cy='165' r='12' fill='%23ffffff' stroke='%23004d00' stroke-width='4'/><circle cx='133' cy='162' r='5' class='eye'/><path stroke='%23004d00' stroke-width='6' fill='none' stroke-linecap='round' d='M 105 195 Q 120 205 140 190'/></svg>"
  },
  {
    name: "Flutter Butterfly",
    classification: "Colorful Butterfly",
    motionProfile: "fly",
    hint: "Perfect for tests involving air gliding, continuous tilt tracking, and background skies.",
    imageBase64: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' width='400' height='400'><style>.wing{stroke:%23cc00cc;stroke-width:10;stroke-linecap:round;stroke-linejoin:round;fill:%23ff66ff;fill-opacity:0.7;}.body{fill:%23ffcc00;stroke:%23cc9900;stroke-width:8;}.antenna{stroke:%23000000;stroke-width:4;fill:none;}</style><rect width='100%25' height='100%25' fill='%23fbf9e6'/><path class='wing' d='M 200 200 C 200 130, 110 90, 110 160 C 110 220, 180 220, 200 200 Z'/><path class='wing' d='M 200 200 C 200 130, 290 90, 290 160 C 290 220, 220 220, 200 200 Z'/><path class='wing' d='M 200 200 C 200 250, 130 280, 130 240 C 130 200, 180 200, 200 200 Z'/><path class='wing' d='M 200 200 C 200 250, 270 280, 270 240 C 270 200, 220 200, 200 200 Z'/><rect class='body' x='187' y='120' width='26' height='160' rx='13'/><path class='antenna' d='M 193 120 Q 180 90 160 100'/><path class='antenna' d='M 207 120 Q 220 90 240 100'/><circle cx='180' cy='150' r='10' fill='%23ffffff' class='wing'/><circle cx='220' cy='150' r='10' fill='%23ffffff' class='wing'/></svg>"
  }
];
