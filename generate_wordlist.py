import json
import argparse
import time # Added for potential rate limiting
try:
    import openai
except ImportError:
    print("OpenAI library not found. Please install it using 'pip install openai' to use the LLM feature.")
    openai = None

def get_word_details_from_llm(word, api_key, api_base=None, model_name="gpt-3.5-turbo"):
    """
    Fetches Chinese definition and part of speech for a word using OpenAI API.
    Returns a dictionary with "definition_zh" and "pos", or None if an error occurs.
    """
    if not openai:
        print("OpenAI library is not available. Skipping LLM call.")
        return None
    if not api_key:
        print("API key not provided. Skipping LLM call.")
        return None

    try:        
        client = openai.OpenAI(api_key=api_key, base_url=api_base)

        prompt = f'''For the English word "{word}", provide its Chinese definition and part(s) of speech.
Return the result as a JSON string with two keys: "definition_zh" and "pos".
Example for "apple": {{ "definition_zh": "苹果", "pos": "n." }}
Example for "watch": {{ "definition_zh": "观看；手表", "pos": "v./n." }}'''

        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides dictionary definitions in JSON format."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
        )
        
        content = completion.choices[0].message.content
        # Try to extract JSON from the response, as LLMs might add extra text
        json_start_index = content.find('{')
        json_end_index = content.rfind('}') + 1
        if json_start_index != -1 and json_end_index != -1:
            json_str = content[json_start_index:json_end_index]
            try:
                details = json.loads(json_str)
                # Basic validation
                if "definition_zh" in details and "pos" in details:
                    return details
                else:
                    print(f"Warning: LLM response for '{word}' missing required keys. Response: {json_str}")
                    return None
            except json.JSONDecodeError:
                print(f"Warning: Could not parse JSON from LLM response for word '{word}'. Response: {content}")
                return None
        else:
            print(f"Warning: No JSON object found in LLM response for word '{word}'. Response: {content}")
            return None

    except openai.APIConnectionError as e:
        print(f"OpenAI APIConnectionError for word '{word}': {e}")
    except openai.RateLimitError as e:
        print(f"OpenAI RateLimitError for word '{word}': {e}. Consider adding delays between requests.")
    except openai.APIStatusError as e:
        print(f"OpenAI APIStatusError for word '{word}': Status {e.status_code}, Response: {e.response}")
    except Exception as e:
        print(f"An unexpected error occurred while calling LLM for word '{word}': {e}")
    return None

def generate_json_from_text_file(input_file_path, output_file_path, use_llm=False, api_key=None, api_base=None, model_name="gpt-3.5-turbo"):
    """
    Reads words from an input text file, filters for 5-letter words,
    and generates a JSON file in the specified format.
    Optionally uses LLM to fill in Chinese definitions and POS.
    """
    five_letter_words_data = []
    words_to_process = []

    print(f"Input file path: {input_file_path}")
    print(f"Output file path: {output_file_path}")
    print(f"Use LLM: {use_llm}")
    print(f"API Key provided: {'Yes' if api_key else 'No'}")
    print(f"API Base: {api_base}")
    print(f"Model name: {model_name}")

    try:
        with open(input_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                word = line.strip().lower()
                if len(word) == 5 and word.isalpha():
                    words_to_process.append(word)
    except FileNotFoundError:
        print(f"Error: Input file not found at {input_file_path}")
        return
    except Exception as e:
        print(f"An error occurred while reading the file: {e}")
        return

    for word in words_to_process:
        definition_zh = "-"
        pos = "-"
        if use_llm and openai and api_key:
            print(f"Fetching details for '{word}' from LLM...")
            details = get_word_details_from_llm(word, api_key, api_base, model_name)
            if details:
                definition_zh = details.get("definition_zh", "-")
                pos = details.get("pos", "-")
            else:
                print(f"Could not fetch details for '{word}' from LLM. Using placeholders.")
            # Optional: add a small delay to avoid hitting rate limits if processing many words
            # time.sleep(1) # Adjust as needed

        five_letter_words_data.append({
            "word": word,
            "definition_zh": definition_zh,
            "pos": pos
        })

    try:
        with open(output_file_path, 'w', encoding='utf-8') as outfile:
            json.dump(five_letter_words_data, outfile, ensure_ascii=False, indent=2)
        print(f"Successfully generated JSON file: {output_file_path}")
        print(f"Processed {len(five_letter_words_data)} five-letter words.")
    except Exception as e:
        print(f"An error occurred while writing the JSON file: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a JSON wordlist from a text file, filtering for 5-letter words. Optionally use LLM for definitions.")
    parser.add_argument("input_file", help="Path to the input text file (one word per line).")
    parser.add_argument("-o", "--output_file", default="wordlist_5_letters.json", help="Path to the output JSON file (default: wordlist_5_letters.json).")
    
    # LLM related arguments
    parser.add_argument("--use-llm", action="store_true", help="Enable fetching definitions and POS using an LLM.")
    parser.add_argument("--api-key", type=str, default=None, help="OpenAI API key. Required if --use-llm is set.")
    parser.add_argument("--api-base", type=str, default=None, help="Custom base URL for OpenAI-compatible API.")
    parser.add_argument("--model", type=str, default="gpt-3.5-turbo", help="The model name to use for LLM calls (default: gpt-3.5-turbo).")

    args = parser.parse_args()

    if args.use_llm and not openai:
        print("Cannot use LLM feature because the OpenAI library is not installed or failed to import.")
        print("Please run 'pip install openai' and try again.")
    elif args.use_llm and not args.api_key:
        print("Error: --api-key is required when --use-llm is specified.")
        print("You can get an API key from https://platform.openai.com/api-keys")
    else:
        generate_json_from_text_file(args.input_file, args.output_file, args.use_llm, args.api_key, args.api_base, args.model) 