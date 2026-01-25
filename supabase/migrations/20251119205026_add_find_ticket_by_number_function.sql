/*
  # Add Helper Function for Finding Tickets by Number

  ## Overview
  Creates a function to find tickets by their 8-character ID prefix.
  This is used by the email-intake function to match email replies to existing tickets.

  ## Function
  - `find_ticket_by_number(ticket_number_prefix)` - Returns ticket ID matching the prefix
*/

CREATE OR REPLACE FUNCTION find_ticket_by_number(ticket_number_prefix text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id uuid;
BEGIN
  -- Find ticket where the first 8 characters of the ID match the prefix
  SELECT id INTO v_ticket_id
  FROM tickets
  WHERE substring(id::text, 1, 8) = ticket_number_prefix
  LIMIT 1;
  
  RETURN v_ticket_id;
END;
$$;

COMMENT ON FUNCTION find_ticket_by_number(text) IS 'Finds a ticket by matching the 8-character ID prefix used in email subjects';
