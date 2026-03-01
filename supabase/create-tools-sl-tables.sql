-- Shopping List Tool Database Schema
-- All tables prefixed with 'tools_sl_'
-- Supports: master items by category (with default seed), shopping lists (active/history), list items, show_on_dashboard.
-- RLS uses (select auth.uid()) for user isolation.
-- Design system: Database Standards (foreign key indexes, optimized RLS, function search_path).

-- ============================================================================
-- DEFAULT ITEMS (seed: standard starting list by category; used to seed user items)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_sl_default_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_default_items_category ON tools_sl_default_items(category);
CREATE INDEX IF NOT EXISTS idx_sl_default_items_display_order ON tools_sl_default_items(display_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sl_default_items_category_name ON tools_sl_default_items(category, name);

-- ============================================================================
-- ITEMS (user's master list; can be seeded from default, then add/remove)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_sl_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_items_user_id ON tools_sl_items(user_id);
CREATE INDEX IF NOT EXISTS idx_sl_items_tool_id ON tools_sl_items(tool_id);
CREATE INDEX IF NOT EXISTS idx_sl_items_user_tool ON tools_sl_items(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_sl_items_category ON tools_sl_items(category);

-- ============================================================================
-- LISTS (shopping lists: name, date, active vs history, show on dashboard)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_sl_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  list_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_on_dashboard BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_lists_user_id ON tools_sl_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_sl_lists_tool_id ON tools_sl_lists(tool_id);
CREATE INDEX IF NOT EXISTS idx_sl_lists_user_tool ON tools_sl_lists(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_sl_lists_is_active ON tools_sl_lists(is_active);
CREATE INDEX IF NOT EXISTS idx_sl_lists_show_on_dashboard ON tools_sl_lists(show_on_dashboard) WHERE show_on_dashboard = true;

-- ============================================================================
-- LIST ITEMS (junction: which items are in each list; references user's master item)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_sl_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES tools_sl_lists(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES tools_sl_items(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sl_list_items_list_id ON tools_sl_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_sl_list_items_item_id ON tools_sl_list_items(item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sl_list_items_list_item ON tools_sl_list_items(list_id, item_id);

-- ============================================================================
-- UPDATED_AT TRIGGERS (with search_path for security)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_sl_default_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_sl_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_sl_lists_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_sl_default_items_updated_at ON tools_sl_default_items;
CREATE TRIGGER trigger_update_sl_default_items_updated_at
  BEFORE UPDATE ON tools_sl_default_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sl_default_items_updated_at();

DROP TRIGGER IF EXISTS trigger_update_sl_items_updated_at ON tools_sl_items;
CREATE TRIGGER trigger_update_sl_items_updated_at
  BEFORE UPDATE ON tools_sl_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sl_items_updated_at();

DROP TRIGGER IF EXISTS trigger_update_sl_lists_updated_at ON tools_sl_lists;
CREATE TRIGGER trigger_update_sl_lists_updated_at
  BEFORE UPDATE ON tools_sl_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_sl_lists_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE tools_sl_default_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_sl_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_sl_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_sl_list_items ENABLE ROW LEVEL SECURITY;

-- Default items: read-only for authenticated (seed data)
DROP POLICY IF EXISTS "Anyone can view default items" ON tools_sl_default_items;
CREATE POLICY "Anyone can view default items" ON tools_sl_default_items
  FOR SELECT TO authenticated USING (true);

-- Items: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own items" ON tools_sl_items;
CREATE POLICY "Users can view their own items" ON tools_sl_items
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own items" ON tools_sl_items;
CREATE POLICY "Users can insert their own items" ON tools_sl_items
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own items" ON tools_sl_items;
CREATE POLICY "Users can update their own items" ON tools_sl_items
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete their own items" ON tools_sl_items;
CREATE POLICY "Users can delete their own items" ON tools_sl_items
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Lists: user CRUD on own rows
DROP POLICY IF EXISTS "Users can view their own lists" ON tools_sl_lists;
CREATE POLICY "Users can view their own lists" ON tools_sl_lists
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own lists" ON tools_sl_lists;
CREATE POLICY "Users can insert their own lists" ON tools_sl_lists
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update their own lists" ON tools_sl_lists;
CREATE POLICY "Users can update their own lists" ON tools_sl_lists
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete their own lists" ON tools_sl_lists;
CREATE POLICY "Users can delete their own lists" ON tools_sl_lists
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- List items: access via list ownership
DROP POLICY IF EXISTS "Users can view their own list items" ON tools_sl_list_items;
CREATE POLICY "Users can view their own list items" ON tools_sl_list_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_sl_lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can insert their own list items" ON tools_sl_list_items;
CREATE POLICY "Users can insert their own list items" ON tools_sl_list_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tools_sl_lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can update their own list items" ON tools_sl_list_items;
CREATE POLICY "Users can update their own list items" ON tools_sl_list_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_sl_lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM tools_sl_lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())));
DROP POLICY IF EXISTS "Users can delete their own list items" ON tools_sl_list_items;
CREATE POLICY "Users can delete their own list items" ON tools_sl_list_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tools_sl_lists l WHERE l.id = list_id AND l.user_id = (select auth.uid())));

-- ============================================================================
-- SEED: Standard starting list (from items_list JSON)
-- ============================================================================
INSERT INTO tools_sl_default_items (category, name, display_order) VALUES
  ('Produce', 'Apples', 0),
  ('Produce', 'Bananas', 1),
  ('Produce', 'Oranges', 2),
  ('Produce', 'Grapes', 3),
  ('Produce', 'Strawberries', 4),
  ('Produce', 'Blueberries', 5),
  ('Produce', 'Lemons', 6),
  ('Produce', 'Limes', 7),
  ('Produce', 'Avocados', 8),
  ('Produce', 'Tomatoes', 9),
  ('Produce', 'Cherry tomatoes', 10),
  ('Produce', 'Lettuce', 11),
  ('Produce', 'Spinach', 12),
  ('Produce', 'Kale', 13),
  ('Produce', 'Carrots', 14),
  ('Produce', 'Celery', 15),
  ('Produce', 'Cucumbers', 16),
  ('Produce', 'Bell peppers', 17),
  ('Produce', 'Onions', 18),
  ('Produce', 'Garlic', 19),
  ('Produce', 'Potatoes', 20),
  ('Produce', 'Sweet potatoes', 21),
  ('Produce', 'Broccoli', 22),
  ('Produce', 'Cauliflower', 23),
  ('Produce', 'Zucchini', 24),
  ('Produce', 'Mushrooms', 25),
  ('Produce', 'Fresh herbs', 26),
  ('Meat & Seafood', 'Chicken breasts', 0),
  ('Meat & Seafood', 'Chicken thighs', 1),
  ('Meat & Seafood', 'Ground beef', 2),
  ('Meat & Seafood', 'Steak', 3),
  ('Meat & Seafood', 'Pork chops', 4),
  ('Meat & Seafood', 'Bacon', 5),
  ('Meat & Seafood', 'Sausage', 6),
  ('Meat & Seafood', 'Deli turkey', 7),
  ('Meat & Seafood', 'Deli ham', 8),
  ('Meat & Seafood', 'Salmon', 9),
  ('Meat & Seafood', 'Shrimp', 10),
  ('Meat & Seafood', 'Canned tuna', 11),
  ('Meat & Seafood', 'Frozen fish fillets', 12),
  ('Dairy & Refrigerated', 'Milk', 0),
  ('Dairy & Refrigerated', 'Almond milk', 1),
  ('Dairy & Refrigerated', 'Oat milk', 2),
  ('Dairy & Refrigerated', 'Butter', 3),
  ('Dairy & Refrigerated', 'Margarine', 4),
  ('Dairy & Refrigerated', 'Eggs', 5),
  ('Dairy & Refrigerated', 'Shredded cheese', 6),
  ('Dairy & Refrigerated', 'Sliced cheese', 7),
  ('Dairy & Refrigerated', 'Cream cheese', 8),
  ('Dairy & Refrigerated', 'Yogurt', 9),
  ('Dairy & Refrigerated', 'Greek yogurt', 10),
  ('Dairy & Refrigerated', 'Sour cream', 11),
  ('Dairy & Refrigerated', 'Cottage cheese', 12),
  ('Dairy & Refrigerated', 'Heavy cream', 13),
  ('Dairy & Refrigerated', 'Coffee creamer', 14),
  ('Bakery & Bread', 'Sandwich bread', 0),
  ('Bakery & Bread', 'Hamburger buns', 1),
  ('Bakery & Bread', 'Hot dog buns', 2),
  ('Bakery & Bread', 'Tortillas', 3),
  ('Bakery & Bread', 'Bagels', 4),
  ('Bakery & Bread', 'English muffins', 5),
  ('Bakery & Bread', 'Dinner rolls', 6),
  ('Bakery & Bread', 'Croissants', 7),
  ('Pantry Staples', 'Rice', 0),
  ('Pantry Staples', 'Pasta', 1),
  ('Pantry Staples', 'Spaghetti', 2),
  ('Pantry Staples', 'Mac & cheese', 3),
  ('Pantry Staples', 'Flour', 4),
  ('Pantry Staples', 'Sugar', 5),
  ('Pantry Staples', 'Brown sugar', 6),
  ('Pantry Staples', 'Powdered sugar', 7),
  ('Pantry Staples', 'Baking soda', 8),
  ('Pantry Staples', 'Baking powder', 9),
  ('Pantry Staples', 'Cornstarch', 10),
  ('Pantry Staples', 'Oats', 11),
  ('Pantry Staples', 'Cereal', 12),
  ('Pantry Staples', 'Pancake mix', 13),
  ('Pantry Staples', 'Syrup', 14),
  ('Pantry Staples', 'Peanut butter', 15),
  ('Pantry Staples', 'Jelly', 16),
  ('Pantry Staples', 'Honey', 17),
  ('Pantry Staples', 'Cooking oil', 18),
  ('Pantry Staples', 'Olive oil', 19),
  ('Pantry Staples', 'Vinegar', 20),
  ('Pantry Staples', 'Soy sauce', 21),
  ('Pantry Staples', 'Ketchup', 22),
  ('Pantry Staples', 'Mustard', 23),
  ('Pantry Staples', 'Mayonnaise', 24),
  ('Pantry Staples', 'Salad dressing', 25),
  ('Pantry Staples', 'Hot sauce', 26),
  ('Pantry Staples', 'Salsa', 27),
  ('Pantry Staples', 'Pasta sauce', 28),
  ('Pantry Staples', 'Canned vegetables', 29),
  ('Pantry Staples', 'Canned beans', 30),
  ('Pantry Staples', 'Canned soup', 31),
  ('Pantry Staples', 'Broth', 32),
  ('Pantry Staples', 'Crackers', 33),
  ('Spices & Seasonings', 'Salt', 0),
  ('Spices & Seasonings', 'Pepper', 1),
  ('Spices & Seasonings', 'Garlic powder', 2),
  ('Spices & Seasonings', 'Onion powder', 3),
  ('Spices & Seasonings', 'Paprika', 4),
  ('Spices & Seasonings', 'Chili powder', 5),
  ('Spices & Seasonings', 'Italian seasoning', 6),
  ('Spices & Seasonings', 'Cinnamon', 7),
  ('Spices & Seasonings', 'Cumin', 8),
  ('Spices & Seasonings', 'Taco seasoning', 9),
  ('Frozen Foods', 'Frozen vegetables', 0),
  ('Frozen Foods', 'Frozen fruit', 1),
  ('Frozen Foods', 'Frozen pizza', 2),
  ('Frozen Foods', 'Ice cream', 3),
  ('Frozen Foods', 'Frozen meals', 4),
  ('Frozen Foods', 'Chicken nuggets', 5),
  ('Frozen Foods', 'Frozen fries', 6),
  ('Snacks', 'Chips', 0),
  ('Snacks', 'Pretzels', 1),
  ('Snacks', 'Popcorn', 2),
  ('Snacks', 'Granola bars', 3),
  ('Snacks', 'Protein bars', 4),
  ('Snacks', 'Trail mix', 5),
  ('Snacks', 'Nuts', 6),
  ('Snacks', 'Cookies', 7),
  ('Snacks', 'Crackers', 8),
  ('Snacks', 'Chocolate', 9),
  ('Beverages', 'Coffee', 0),
  ('Beverages', 'Tea', 1),
  ('Beverages', 'Bottled water', 2),
  ('Beverages', 'Sparkling water', 3),
  ('Beverages', 'Soda', 4),
  ('Beverages', 'Juice', 5),
  ('Beverages', 'Sports drinks', 6),
  ('Beverages', 'Energy drinks', 7),
  ('Paper & Disposable Goods', 'Toilet paper', 0),
  ('Paper & Disposable Goods', 'Paper towels', 1),
  ('Paper & Disposable Goods', 'Facial tissues', 2),
  ('Paper & Disposable Goods', 'Napkins', 3),
  ('Paper & Disposable Goods', 'Aluminum foil', 4),
  ('Paper & Disposable Goods', 'Plastic wrap', 5),
  ('Paper & Disposable Goods', 'Parchment paper', 6),
  ('Paper & Disposable Goods', 'Trash bags', 7),
  ('Paper & Disposable Goods', 'Sandwich bags', 8),
  ('Paper & Disposable Goods', 'Food storage bags', 9),
  ('Cleaning Supplies', 'Dish soap', 0),
  ('Cleaning Supplies', 'Dishwasher pods', 1),
  ('Cleaning Supplies', 'Laundry detergent', 2),
  ('Cleaning Supplies', 'Fabric softener', 3),
  ('Cleaning Supplies', 'Stain remover', 4),
  ('Cleaning Supplies', 'All-purpose cleaner', 5),
  ('Cleaning Supplies', 'Glass cleaner', 6),
  ('Cleaning Supplies', 'Disinfecting wipes', 7),
  ('Cleaning Supplies', 'Sponges', 8),
  ('Cleaning Supplies', 'Scrub brushes', 9),
  ('Cleaning Supplies', 'Broom', 10),
  ('Cleaning Supplies', 'Mop pads', 11),
  ('Cleaning Supplies', 'Toilet cleaner', 12),
  ('Cleaning Supplies', 'Toilet brush', 13),
  ('Personal Care', 'Shampoo', 0),
  ('Personal Care', 'Conditioner', 1),
  ('Personal Care', 'Body wash', 2),
  ('Personal Care', 'Bar soap', 3),
  ('Personal Care', 'Hand soap', 4),
  ('Personal Care', 'Toothpaste', 5),
  ('Personal Care', 'Toothbrushes', 6),
  ('Personal Care', 'Floss', 7),
  ('Personal Care', 'Mouthwash', 8),
  ('Personal Care', 'Deodorant', 9),
  ('Personal Care', 'Razors', 10),
  ('Personal Care', 'Shaving cream', 11),
  ('Personal Care', 'Lotion', 12),
  ('Personal Care', 'Sunscreen', 13),
  ('Personal Care', 'Feminine hygiene products', 14),
  ('Personal Care', 'Cotton balls', 15),
  ('Personal Care', 'Cotton swabs', 16),
  ('Baby', 'Diapers', 0),
  ('Baby', 'Pull-ups', 1),
  ('Baby', 'Baby wipes', 2),
  ('Baby', 'Formula', 3),
  ('Baby', 'Baby food', 4),
  ('Baby', 'Baby shampoo', 5),
  ('Baby', 'Diaper rash cream', 6),
  ('Pet Supplies', 'Dog food', 0),
  ('Pet Supplies', 'Cat food', 1),
  ('Pet Supplies', 'Pet treats', 2),
  ('Pet Supplies', 'Litter', 3),
  ('Pet Supplies', 'Waste bags', 4),
  ('Pet Supplies', 'Pet shampoo', 5),
  ('Health & Medicine', 'Pain relievers', 0),
  ('Health & Medicine', 'Cold medicine', 1),
  ('Health & Medicine', 'Allergy medicine', 2),
  ('Health & Medicine', 'Cough drops', 3),
  ('Health & Medicine', 'Vitamins', 4),
  ('Health & Medicine', 'Bandages', 5),
  ('Health & Medicine', 'Hydrogen peroxide', 6),
  ('Health & Medicine', 'Rubbing alcohol', 7),
  ('Health & Medicine', 'Thermometer', 8),
  ('Household Items', 'Light bulbs', 0),
  ('Household Items', 'Batteries', 1),
  ('Household Items', 'Extension cords', 2),
  ('Household Items', 'Power strips', 3),
  ('Household Items', 'Flashlights', 4),
  ('Household Items', 'Air filters', 5),
  ('Household Items', 'Furnace filters', 6),
  ('Household Items', 'Water filters', 7),
  ('Household Items', 'Smoke detector batteries', 8),
  ('Household Items', 'Command hooks', 9),
  ('Household Items', 'Super glue', 10),
  ('Household Items', 'Duct tape', 11),
  ('Household Items', 'Packing tape', 12),
  ('Household Items', 'Hangers', 13),
  ('Household Items', 'Laundry baskets', 14),
  ('Household Items', 'Lint roller', 15),
  ('Household Items', 'Iron', 16),
  ('Household Items', 'Ironing board cover', 17),
  ('Household Items', 'Garment bags', 18),
  ('Household Items', 'Shoe inserts', 19),
  ('Household Items', 'Bed sheets', 20),
  ('Household Items', 'Pillowcases', 21),
  ('Household Items', 'Pillows', 22),
  ('Household Items', 'Blankets', 23),
  ('Household Items', 'Comforter', 24),
  ('Household Items', 'Mattress protector', 25),
  ('Household Items', 'Towels', 26),
  ('Household Items', 'Washcloths', 27),
  ('Household Items', 'Bath mats', 28),
  ('Household Items', 'Shower curtain', 29),
  ('Household Items', 'Shower curtain liner', 30),
  ('Household Items', 'Dish towels', 31),
  ('Household Items', 'Oven mitts', 32),
  ('Household Items', 'Pot holders', 33),
  ('Household Items', 'Food storage containers', 34),
  ('Household Items', 'Measuring cups', 35),
  ('Household Items', 'Measuring spoons', 36),
  ('Household Items', 'Cutting boards', 37),
  ('Household Items', 'Can opener', 38),
  ('Household Items', 'Kitchen scissors', 39),
  ('Household Items', 'Water bottle', 40),
  ('Household Items', 'Travel mug', 41),
  ('Household Items', 'Lawn bags', 42),
  ('Household Items', 'Garden gloves', 43),
  ('Household Items', 'Ice melt', 44),
  ('Household Items', 'Snow shovel', 45),
  ('Household Items', 'Outdoor light bulbs', 46),
  ('Household Items', 'Charcoal', 47),
  ('Household Items', 'Lighter fluid', 48),
  ('Household Items', 'Bug spray', 49),
  ('Household Items', 'Citronella candles', 50),
  ('Household Items', 'Storage bins', 51),
  ('Household Items', 'Drawer organizers', 52),
  ('Household Items', 'Closet organizers', 53),
  ('Household Items', 'Shelf liners', 54),
  ('Household Items', 'Label stickers', 55),
  ('Household Items', 'Storage baskets', 56)
ON CONFLICT (category, name) DO NOTHING;
