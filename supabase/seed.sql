-- =============================================================================
-- Local / dev seed data — run automatically by `npx supabase db reset`.
-- NEVER run against the hosted project.
--
-- All passages and questions are ORIGINAL content written in IELTS style for
-- this project (INSTRUCTIONS §3: never copy Cambridge IELTS material).
--
-- Contents (database-schema.md §5.2):
--   Reading Mock 1      3 passages, 39 question rows = 40 marks, published.
--                       PRACTICE (no time limit, answers shown) and
--                       MOCK (60 min, 3 attempts, answers after submit).
--   Reading Practice 1  1 passage, 13 marks, published. PRACTICE only
--                       (13 marks give no band, so MOCK is disabled).
-- The student picks the mode when starting an attempt (D-015).
-- Default band tables come from the migration, not from this file.
--
-- Users are not seeded. Sign up through the app / Supabase Auth, then promote:
--   update public.profiles set role = 'admin' where user_id = '<uuid>';
-- =============================================================================

-- Helpers (temporary: they disappear when the seed session ends) -------------

-- Settings of one mode of a version (test_version_modes).
create function pg_temp.add_mode(
    p_version uuid, p_mode text, p_enabled boolean, p_time_limit int, p_max_attempts int,
    p_visibility text, p_audio_free boolean, p_max_plays int default null)
returns void
language sql
as $$
    insert into public.test_version_modes
        (test_version_id, mode, enabled, time_limit_seconds, max_attempts, answer_visibility,
         allow_pause, allow_replay, allow_seek, max_plays)
    values (p_version, p_mode, p_enabled, p_time_limit, p_max_attempts, p_visibility,
            p_audio_free, p_audio_free, p_audio_free, p_max_plays)
$$;

create function pg_temp.add_section(
    p_version uuid, p_position int, p_title text, p_instructions text, p_content text,
    p_section_type text default 'reading')
returns uuid
language sql
as $$
    insert into public.sections (test_version_id, section_type, position, title, instructions, content)
    values (p_version, p_section_type, p_position, p_title, p_instructions, p_content)
    returning id
$$;

create function pg_temp.add_group(
    p_section uuid, p_position int, p_instructions text,
    p_content text default null, p_options jsonb default null, p_rules jsonb default '{}'::jsonb)
returns uuid
language sql
as $$
    insert into public.question_groups (section_id, position, instructions, content, options, rules)
    values (p_section, p_position, p_instructions, p_content, p_options, p_rules)
    returning id
$$;

-- Inserts a question and its answer key.
create function pg_temp.add_question(
    p_group uuid, p_position int, p_type text, p_format text, p_prompt text,
    p_correct jsonb, p_explanation text,
    p_options jsonb default null, p_config jsonb default '{}'::jsonb, p_marks int default 1)
returns uuid
language plpgsql
as $$
declare
    v_id uuid;
begin
    insert into public.questions
        (question_group_id, position, question_type, answer_format, prompt, options, config, max_score)
    values (p_group, p_position, p_type, p_format, p_prompt, p_options, p_config, p_marks)
    returning id into v_id;

    insert into public.answer_keys (question_id, correct_answer, explanation)
    values (v_id, p_correct, p_explanation);

    return v_id;
end;
$$;


-- =============================================================================
-- Reading Mock 1  (test a0000000-…-001, version a0000000-…-011)
-- =============================================================================
do $seed$
declare
    v_test    constant uuid := 'a0000000-0000-4000-8000-000000000001';
    v_version constant uuid := 'a0000000-0000-4000-8000-000000000011';
    v_section uuid;
    v_group   uuid;
    c_tfng constant text := $i$Do the following statements agree with the information given in Reading Passage 1?

Write

**TRUE** if the statement agrees with the information
**FALSE** if the statement contradicts the information
**NOT GIVEN** if there is no information on this$i$;
begin
    insert into public.tests (id, title, description, type)
    values (v_test, 'Academic Reading Mock 1',
            'Full computer-delivered style Reading test: 3 passages, 40 questions, 60 minutes.', 'reading');

    insert into public.test_versions (id, test_id, version_number)
    values (v_version, v_test, 1);
    perform pg_temp.add_mode(v_version, 'practice', true, null, null, 'immediately_in_practice', true);
    perform pg_temp.add_mode(v_version, 'mock', true, 3600, 3, 'after_submit', false, 1);

    -- -------------------------------------------------------------------------
    -- Passage 1 — Questions 1–13
    -- -------------------------------------------------------------------------
    v_section := pg_temp.add_section(v_version, 1, 'Reading Passage 1',
        'You should spend about 20 minutes on **Questions 1–13**, which are based on Reading Passage 1 below.',
        $p1$# Farming Above the Streets

Over the past two decades, the flat roofs of many large cities have slowly begun to turn green. What started as a few hobby gardens on apartment blocks has grown into a small but serious industry. Commercial rooftop farms now operate in cities on almost every continent, and some supply fresh vegetables to thousands of households each week. Supporters argue that these farms make productive use of space that would otherwise be wasted, and that they bring city dwellers closer to the food they eat.

The idea itself is not new. In the early twentieth century, several hotels in European capitals grew herbs and salad leaves on their roofs to supply their own kitchens. However, these gardens were small, and most disappeared when refrigerated transport made it cheap to bring produce in from the countryside. The modern revival began only when two developments came together: lightweight growing systems that do not need deep soil, and a rising demand among urban consumers for food that is grown locally.

Most modern rooftop farms fall into one of two types. The first is the open-air farm, in which crops are grown in shallow beds of soil or compost directly on the roof. These farms are relatively cheap to build, but they can only operate during the warmer months and are exposed to strong winds. The second type is the rooftop greenhouse, which uses glass or plastic panels to protect the plants. Greenhouses cost far more to install, but they allow growers to harvest all year round, and many of them use hydroponic systems, in which plants grow in water containing dissolved nutrients rather than in soil.

Weight is the first problem that any rooftop farmer must solve. Wet soil is extremely heavy, and many older buildings were never designed to carry such a load. For this reason, an engineer must usually inspect a roof before any planting begins, and some projects have been abandoned at this stage. Hydroponic systems help to reduce the load, as water and lightweight growing materials weigh much less than a deep layer of earth.

Rooftop farms also bring benefits to the buildings beneath them. A layer of plants acts as insulation, keeping the rooms below cooler in summer and reducing the energy needed for air conditioning. In one study of a supermarket roof, the temperature of the roof surface on a hot afternoon was 25 degrees lower under the plants than on the bare section next to it. Plants also absorb rainwater, which reduces the pressure on city drains during heavy storms. Some greenhouse operators go further, capturing warm air from the building below and using it to heat their crops in winter.

Critics, however, point out that rooftop farms produce only a tiny fraction of the food a city needs. Most of them grow leafy greens, herbs and tomatoes — crops that are light, fast-growing and sell for a high price. Staple foods such as wheat or potatoes, which require large areas of land, are almost never grown on roofs. Labour is another concern. Carrying tools and harvests up and down stairs or lifts takes time, and wages in cities are usually higher than in the countryside.

Despite these limitations, the number of rooftop farms continues to grow. Several city governments now offer tax reductions to building owners who install green roofs, and new office blocks are increasingly designed with rooftop farming in mind. For many of its supporters, the true value of a rooftop farm lies not in the amount of food it produces but in the way it changes how people in cities think about where their food comes from.$p1$);

    -- Questions 1–5: TRUE / FALSE / NOT GIVEN
    v_group := pg_temp.add_group(v_section, 1, $i$**Questions 1–5**

$i$ || c_tfng);
    perform pg_temp.add_question(v_group, 1, 'true_false_not_given', 'choice',
        'Hotel rooftop gardens in the early twentieth century supplied food to the hotels'' own kitchens.',
        '{"choice":"TRUE"}', 'Paragraph 2: hotels "grew herbs and salad leaves on their roofs to supply their own kitchens".');
    perform pg_temp.add_question(v_group, 2, 'true_false_not_given', 'choice',
        'Open-air rooftop farms are more expensive to build than rooftop greenhouses.',
        '{"choice":"FALSE"}', 'Paragraph 3: open-air farms are "relatively cheap to build", while greenhouses "cost far more to install".');
    perform pg_temp.add_question(v_group, 3, 'true_false_not_given', 'choice',
        'Most rooftop greenhouses are made of glass rather than plastic.',
        '{"choice":"NOT_GIVEN"}', 'Paragraph 3 says greenhouses use "glass or plastic panels" but says nothing about which is more common.');
    perform pg_temp.add_question(v_group, 4, 'true_false_not_given', 'choice',
        'Some rooftop farming projects have been cancelled after a roof inspection.',
        '{"choice":"TRUE"}', 'Paragraph 4: an engineer inspects the roof first, "and some projects have been abandoned at this stage".');
    perform pg_temp.add_question(v_group, 5, 'true_false_not_given', 'choice',
        'In some cities, rooftop farms are an important source of potatoes.',
        '{"choice":"FALSE"}', 'Paragraph 6: staple foods "such as wheat or potatoes … are almost never grown on roofs".');

    -- Questions 6–9: short answer
    v_group := pg_temp.add_group(v_section, 2, $i$**Questions 6–9**

Answer the questions below.

Choose **NO MORE THAN TWO WORDS AND/OR A NUMBER** from the passage for each answer.$i$,
        null, null, '{"max_words": 2, "allow_number": true}');
    perform pg_temp.add_question(v_group, 1, 'short_answer', 'text',
        'In a hydroponic system, what do plants grow in instead of soil?',
        '{"accepted":["water"]}', 'Paragraph 3: plants "grow in water containing dissolved nutrients rather than in soil".');
    perform pg_temp.add_question(v_group, 2, 'short_answer', 'text',
        'In the supermarket study, how many degrees cooler was the roof surface under the plants?',
        '{"accepted":["25","25 degrees","twenty-five","twenty-five degrees","twenty five"]}',
        'Paragraph 5: the surface "was 25 degrees lower under the plants".');
    perform pg_temp.add_question(v_group, 3, 'short_answer', 'text',
        'What do plants absorb that would otherwise put pressure on city drains?',
        '{"accepted":["rainwater","rain water"]}', 'Paragraph 5: "Plants also absorb rainwater, which reduces the pressure on city drains".');
    perform pg_temp.add_question(v_group, 4, 'short_answer', 'text',
        'What do some greenhouse operators take from the building below to heat their crops?',
        '{"accepted":["warm air","air"]}', 'Paragraph 5: operators capture "warm air from the building below".');

    -- Questions 10–13: note completion
    v_group := pg_temp.add_group(v_section, 3, $i$**Questions 10–13**

Complete the notes below.

Choose **ONE WORD ONLY** from the passage for each answer.$i$,
        $c$### Rooftop farming

**Background**
- modern revival: lightweight growing systems and a rising {{gap:10}} for locally grown food

**Challenges**
- an engineer checks that the roof can carry the {{gap:11}} of wet soil
- crops: mainly leafy greens, herbs and {{gap:12}}
- {{gap:13}} costs are higher in cities than in the countryside$c$,
        null, '{"max_words": 1}');
    perform pg_temp.add_question(v_group, 1, 'note_completion', 'text',
        'modern revival: lightweight growing systems and a rising ______ for locally grown food',
        '{"accepted":["demand"]}', 'Paragraph 2: "a rising demand among urban consumers for food that is grown locally".');
    perform pg_temp.add_question(v_group, 2, 'note_completion', 'text',
        'an engineer checks that the roof can carry the ______ of wet soil',
        '{"accepted":["weight","load"]}', 'Paragraph 4: "Weight is the first problem … many older buildings were never designed to carry such a load".');
    perform pg_temp.add_question(v_group, 3, 'note_completion', 'text',
        'crops: mainly leafy greens, herbs and ______',
        '{"accepted":["tomatoes"]}', 'Paragraph 6: "Most of them grow leafy greens, herbs and tomatoes".');
    perform pg_temp.add_question(v_group, 4, 'note_completion', 'text',
        '______ costs are higher in cities than in the countryside',
        '{"accepted":["labour","labor"]}', 'Paragraph 6: "Labour is another concern … wages in cities are usually higher than in the countryside".');

    -- -------------------------------------------------------------------------
    -- Passage 2 — Questions 14–26
    -- -------------------------------------------------------------------------
    v_section := pg_temp.add_section(v_version, 2, 'Reading Passage 2',
        'You should spend about 20 minutes on **Questions 14–26**, which are based on Reading Passage 2 below.',
        $p2$# Catching Water from the Air

**A** In some of the driest places on Earth, water floats past every morning in the form of fog. Along certain coasts, cold ocean currents cool the air above them, and the moisture in that air condenses into tiny droplets that drift inland. The droplets are too small to fall as rain, so the land beneath remains almost completely dry. For centuries, however, a few plants and animals have known how to capture this water, and in recent decades engineers have begun to copy them.

**B** One of the best-known examples comes from a desert beetle whose back is covered with small bumps. When fog blows across the beetle, droplets gather on the bumps, grow larger and eventually roll down into its mouth. Certain desert grasses work in a similar way, with fine hairs that collect moisture and channel it towards the roots. These natural designs share a simple principle: provide a surface on which droplets can meet, combine and become heavy enough to move under gravity.

**C** The modern fog collector applies the same principle on a larger scale. A typical collector is a rectangular sheet of plastic mesh, stretched between two poles and placed at right angles to the wind. As fog passes through the mesh, droplets stick to the fibres and run down into a gutter at the bottom, from which a pipe carries the water to a storage tank. A single collector of forty square metres can produce several hundred litres on a foggy day, although the amount varies greatly with the season, the strength of the wind and the density of the fog.

**D** Choosing where to put collectors is the most important decision in any project. Before any large structures are built, engineers usually spend at least a year measuring conditions with small test panels of one square metre. The best sites are on ridges or hillsides that face the sea, at heights where clouds most often touch the ground. A difference of just a few hundred metres in position can double or halve the volume of water collected, so careful testing at this stage saves considerable money later.

**E** Fog collection has clear advantages. The equipment is cheap, it needs no fuel or electricity, and the water it produces is usually clean enough to drink after simple filtering. Yet many projects have failed within a few years. In several cases, nets were torn by strong winds and never repaired because local people had not been trained to maintain them. Elsewhere, the water supply turned out to be too small or too unreliable to justify the effort. Experience has shown that projects are most successful when the community is involved from the beginning and takes responsibility for the equipment.

**F** Researchers are now trying to improve the mesh itself. Laboratory experiments with new fibres and coatings suggest that a better-designed net could capture up to five times as much water as the standard material, partly because smaller droplets would no longer blow straight through the holes. If these designs prove strong enough to survive outdoors, fog harvesting could become a practical source of water for farms and small towns, not just for individual villages.$p2$);

    -- Questions 14–19: matching headings
    v_group := pg_temp.add_group(v_section, 1, $i$**Questions 14–19**

Reading Passage 2 has six paragraphs, **A–F**.

Choose the correct heading for each paragraph from the list of headings below.$i$,
        null,
        $j$[
            {"key":"i","text":"Learning from nature's own water collectors"},
            {"key":"ii","text":"Low-cost technology, mixed results"},
            {"key":"iii","text":"How a simple structure turns fog into usable water"},
            {"key":"iv","text":"The high cost of storing collected water"},
            {"key":"v","text":"Testing before building"},
            {"key":"vi","text":"Water that never reaches the ground"},
            {"key":"vii","text":"The search for a more efficient material"},
            {"key":"viii","text":"Government support for fog projects"},
            {"key":"ix","text":"Comparing fog water with rainwater"}
        ]$j$::jsonb);
    perform pg_temp.add_question(v_group, 1, 'matching_headings', 'choice', 'Paragraph A',
        '{"choice":"vi"}', 'Paragraph A: the droplets "are too small to fall as rain, so the land beneath remains almost completely dry".');
    perform pg_temp.add_question(v_group, 2, 'matching_headings', 'choice', 'Paragraph B',
        '{"choice":"i"}', 'Paragraph B describes a beetle and desert grasses that collect fog water.');
    perform pg_temp.add_question(v_group, 3, 'matching_headings', 'choice', 'Paragraph C',
        '{"choice":"iii"}', 'Paragraph C explains how a mesh, gutter and pipe deliver fog water to a tank.');
    perform pg_temp.add_question(v_group, 4, 'matching_headings', 'choice', 'Paragraph D',
        '{"choice":"v"}', 'Paragraph D: engineers spend "at least a year measuring conditions with small test panels" before building.');
    perform pg_temp.add_question(v_group, 5, 'matching_headings', 'choice', 'Paragraph E',
        '{"choice":"ii"}', 'Paragraph E: the equipment is cheap, "yet many projects have failed within a few years".');
    perform pg_temp.add_question(v_group, 6, 'matching_headings', 'choice', 'Paragraph F',
        '{"choice":"vii"}', 'Paragraph F: "Researchers are now trying to improve the mesh itself."');

    -- Questions 20–22: multiple choice (one answer)
    v_group := pg_temp.add_group(v_section, 2, $i$**Questions 20–22**

Choose the correct letter, **A, B, C** or **D**.$i$);
    perform pg_temp.add_question(v_group, 1, 'mcq_single', 'choice',
        'According to paragraph A, fog does not provide water to the land below because',
        '{"choice":"B"}', 'Paragraph A: "The droplets are too small to fall as rain."',
        $j$[{"key":"A","text":"the droplets are carried out to sea."},
            {"key":"B","text":"the droplets are too small to fall."},
            {"key":"C","text":"the fog only forms at night."},
            {"key":"D","text":"the air is too warm for condensation."}]$j$::jsonb);
    perform pg_temp.add_question(v_group, 2, 'mcq_single', 'choice',
        'The beetle described in paragraph B collects water by',
        '{"choice":"C"}', 'Paragraph B: droplets "gather on the bumps" on its back and roll into its mouth.',
        $j$[{"key":"A","text":"digging into damp sand."},
            {"key":"B","text":"drinking from desert grasses."},
            {"key":"C","text":"letting droplets form on its back."},
            {"key":"D","text":"storing water inside its body."}]$j$::jsonb);
    perform pg_temp.add_question(v_group, 3, 'mcq_single', 'choice',
        'What does the writer say about the amount of water a collector produces?',
        '{"choice":"B"}', 'Paragraph C: the amount "varies greatly with the season, the strength of the wind and the density of the fog".',
        $j$[{"key":"A","text":"It depends mainly on the size of the mesh."},
            {"key":"B","text":"It changes according to weather conditions."},
            {"key":"C","text":"It is greater in summer than in winter."},
            {"key":"D","text":"It has been overestimated by engineers."}]$j$::jsonb);

    -- Questions 23–24: multiple choice (choose TWO) — one row worth 2 marks
    v_group := pg_temp.add_group(v_section, 3, $i$**Questions 23–24**

Choose **TWO** letters, **A–E**.$i$);
    perform pg_temp.add_question(v_group, 1, 'mcq_multi', 'multi_choice',
        'Which **TWO** reasons does the writer give for the failure of some fog collection projects?',
        '{"choices":["A","D"]}', 'Paragraph E: nets "were torn by strong winds and never repaired" (A), and the supply "turned out to be too small or too unreliable" (D).',
        $j$[{"key":"A","text":"The nets were damaged and not repaired."},
            {"key":"B","text":"The water was not safe to drink."},
            {"key":"C","text":"The equipment was too expensive to run."},
            {"key":"D","text":"The amount of water was too small or unreliable."},
            {"key":"E","text":"Local governments withdrew their support."}]$j$::jsonb,
        '{"select_count": 2}', 2);

    -- Questions 25–26: sentence completion
    v_group := pg_temp.add_group(v_section, 4, $i$**Questions 25–26**

Complete the sentences below.

Choose **NO MORE THAN TWO WORDS** from the passage for each answer.$i$,
        null, null, '{"max_words": 2}');
    perform pg_temp.add_question(v_group, 1, 'sentence_completion', 'text',
        'Before building large collectors, engineers measure conditions using small {{gap}}.',
        '{"accepted":["test panels","panels"]}', 'Paragraph D: "measuring conditions with small test panels of one square metre".');
    perform pg_temp.add_question(v_group, 2, 'sentence_completion', 'text',
        'New fibres and coatings may stop smaller droplets from blowing through the {{gap}} in the mesh.',
        '{"accepted":["holes"]}', 'Paragraph F: "smaller droplets would no longer blow straight through the holes".');

    -- -------------------------------------------------------------------------
    -- Passage 3 — Questions 27–40
    -- -------------------------------------------------------------------------
    v_section := pg_temp.add_section(v_version, 3, 'Reading Passage 3',
        'You should spend about 20 minutes on **Questions 27–40**, which are based on Reading Passage 3 below.',
        $p3$# The Elastic Clock

Most of us have noticed that time does not always seem to pass at the same speed. A ten-minute wait for a delayed train can feel endless, while an afternoon spent with friends seems to vanish. Psychologists have studied this experience for more than a century, and although they have not settled every question, their findings reveal a great deal about how the mind keeps track of time.

One long-standing idea is that the brain contains a kind of internal clock that produces regular 'ticks', which are counted to estimate how much time has passed. Supporters of this model, such as the researcher Helen Marsh, have shown that when people are made more alert — for example, by listening to fast, loud music — they judge a fixed period to be longer than it really is. Marsh's explanation is that excitement speeds up the internal clock, so more ticks are counted. The model is attractive in its simplicity, but in my view it struggles to explain why the same period can feel short while we are living through it and long when we look back on it later.

That puzzle has been taken up by Daniel Okafor, who distinguishes between 'prospective' and 'retrospective' judgements of time. A prospective judgement is made while an event is happening, when a person is paying attention to the passing of time; a retrospective judgement is made afterwards, from memory. Okafor's experiments suggest that retrospective judgements depend largely on how many distinct memories a period has left behind. A week full of new places and experiences therefore seems long in hindsight, even if it flew by at the time, while a dull, repetitive week shrinks in the memory. I find this explanation persuasive, and it fits the common complaint that the years seem to pass more quickly as we grow older: adult life often contains fewer novel events than childhood.

Attention plays an equally important role. Studies by Sofia Lindqvist found that people who were given a demanding task, such as solving puzzles under time pressure, consistently underestimated how long they had been working, whereas those who were simply told to wait in an empty room overestimated the time. Lindqvist argues that the mind has a limited capacity for attention: when most of it is used by the task, little is left for monitoring time. This helps to explain why waiting rooms feel so slow, and why some businesses place mirrors near lifts or play music in queues — anything that draws attention away from the clock makes a wait feel shorter.

Emotion complicates the picture further. Experiments by Rajiv Menon have shown that frightening experiences, such as a short fall, are often remembered as lasting longer than they did. Menon initially suspected that fear slows time down as it happens, allowing a person to perceive events in greater detail. However, his later tests found no evidence that frightened participants could take in more information per second. He now believes the effect occurs when the memory is formed: a frightening moment is recorded more richly than an ordinary one, and this richness is later interpreted as duration.

What should we make of these different findings? It is tempting to look for a single mechanism that accounts for them all, but I suspect this is a mistake. Our sense of time seems instead to be built from several processes — arousal, attention and memory — each of which can stretch or shrink our experience in its own way. Rather than being a weakness, this flexibility may be useful: a mind that pays closer attention to time when nothing else is happening, and records exciting events in detail, is well suited to learning from the world around it. One practical lesson is clear, though. Those who want their lives to feel long in retrospect would do well to fill them with variety.$p3$);

    -- Questions 27–31: YES / NO / NOT GIVEN
    v_group := pg_temp.add_group(v_section, 1, $i$**Questions 27–31**

Do the following statements agree with the claims of the writer in Reading Passage 3?

Write

**YES** if the statement agrees with the claims of the writer
**NO** if the statement contradicts the claims of the writer
**NOT GIVEN** if it is impossible to say what the writer thinks about this$i$);
    perform pg_temp.add_question(v_group, 1, 'yes_no_not_given', 'choice',
        'The internal clock model cannot explain why a period may feel different during an event and afterwards.',
        '{"choice":"YES"}', 'Paragraph 2: "in my view it struggles to explain why the same period can feel short while we are living through it and long when we look back on it later".');
    perform pg_temp.add_question(v_group, 2, 'yes_no_not_given', 'choice',
        'Okafor''s theory offers a convincing reason why time seems to pass more quickly as people get older.',
        '{"choice":"YES"}', 'Paragraph 3: "I find this explanation persuasive, and it fits the common complaint that the years seem to pass more quickly as we grow older".');
    perform pg_temp.add_question(v_group, 3, 'yes_no_not_given', 'choice',
        'Playing music in queues is unlikely to change how long a wait feels.',
        '{"choice":"NO"}', 'Paragraph 4: music in queues draws attention away from the clock, and this "makes a wait feel shorter".');
    perform pg_temp.add_question(v_group, 4, 'yes_no_not_given', 'choice',
        'Menon''s later results need to be repeated by other researchers before they can be accepted.',
        '{"choice":"NOT_GIVEN"}', 'Paragraph 5 reports Menon''s later tests, but the writer gives no opinion on whether they need to be repeated.');
    perform pg_temp.add_question(v_group, 5, 'yes_no_not_given', 'choice',
        'A single mechanism is likely to explain all of the findings described in the passage.',
        '{"choice":"NO"}', 'Paragraph 6: "It is tempting to look for a single mechanism … but I suspect this is a mistake."');

    -- Questions 32–35: matching features
    v_group := pg_temp.add_group(v_section, 2, $i$**Questions 32–35**

Look at the following findings (Questions 32–35) and the list of researchers below.

Match each finding with the correct researcher, **A–D**.

**NB** You may use any letter more than once.$i$,
        null,
        $j$[{"key":"A","text":"Helen Marsh"},
            {"key":"B","text":"Daniel Okafor"},
            {"key":"C","text":"Sofia Lindqvist"},
            {"key":"D","text":"Rajiv Menon"}]$j$::jsonb,
        '{"allow_option_reuse": true}');
    perform pg_temp.add_question(v_group, 1, 'matching_features', 'choice',
        'Being kept busy can make a period of time seem shorter.',
        '{"choice":"C"}', 'Paragraph 4: Lindqvist found that people given a demanding task "underestimated how long they had been working".');
    perform pg_temp.add_question(v_group, 2, 'matching_features', 'choice',
        'Strong feelings may affect the way an experience is stored in memory.',
        '{"choice":"D"}', 'Paragraph 5: Menon "now believes the effect occurs when the memory is formed".');
    perform pg_temp.add_question(v_group, 3, 'matching_features', 'choice',
        'A state of high alertness causes people to overestimate time.',
        '{"choice":"A"}', 'Paragraph 2: in Marsh''s studies, more alert people "judge a fixed period to be longer than it really is".');
    perform pg_temp.add_question(v_group, 4, 'matching_features', 'choice',
        'The number of separate memories affects later estimates of time.',
        '{"choice":"B"}', 'Paragraph 3: Okafor''s retrospective judgements "depend largely on how many distinct memories a period has left behind".');

    -- Questions 36–40: summary completion with a word bank
    v_group := pg_temp.add_group(v_section, 3, $i$**Questions 36–40**

Complete the summary using the list of words, **A–I**, below.$i$,
        $c$### Why time stretches and shrinks

Research suggests that our sense of time is not controlled by a single {{gap:36}}. When we look back on a period, its length depends on the number of {{gap:37}} experiences it contains, which may explain why adults feel that the years pass quickly. While we are waiting, time seems slow because our {{gap:38}} is free to focus on the clock. Frightening events seem long because they are recorded in greater {{gap:39}}. According to the writer, the flexible nature of our sense of time may help us to {{gap:40}} from our surroundings.$c$,
        $j$[{"key":"A","text":"mechanism"},
            {"key":"B","text":"novel"},
            {"key":"C","text":"attention"},
            {"key":"D","text":"detail"},
            {"key":"E","text":"learn"},
            {"key":"F","text":"speed"},
            {"key":"G","text":"music"},
            {"key":"H","text":"repetitive"},
            {"key":"I","text":"emotion"}]$j$::jsonb);
    perform pg_temp.add_question(v_group, 1, 'summary_completion', 'choice',
        'our sense of time is not controlled by a single ______',
        '{"choice":"A"}', 'Paragraph 6: looking for "a single mechanism" is, the writer suspects, a mistake.');
    perform pg_temp.add_question(v_group, 2, 'summary_completion', 'choice',
        'its length depends on the number of ______ experiences it contains',
        '{"choice":"B"}', 'Paragraph 3: adult life "often contains fewer novel events than childhood".');
    perform pg_temp.add_question(v_group, 3, 'summary_completion', 'choice',
        'time seems slow because our ______ is free to focus on the clock',
        '{"choice":"C"}', 'Paragraph 4: when attention is not used by a task, it is left for "monitoring time".');
    perform pg_temp.add_question(v_group, 4, 'summary_completion', 'choice',
        'they are recorded in greater ______',
        '{"choice":"D"}', 'Paragraph 5: a frightening moment "is recorded more richly than an ordinary one".');
    perform pg_temp.add_question(v_group, 5, 'summary_completion', 'choice',
        'may help us to ______ from our surroundings',
        '{"choice":"E"}', 'Paragraph 6: such a mind "is well suited to learning from the world around it".');

    -- Publish -----------------------------------------------------------------
    update public.test_versions set status = 'published', published_at = now() where id = v_version;
end
$seed$;


-- =============================================================================
-- Reading Practice 1  (test a0000000-…-002, version a0000000-…-012)
-- =============================================================================
do $seed$
declare
    v_test    constant uuid := 'a0000000-0000-4000-8000-000000000002';
    v_version constant uuid := 'a0000000-0000-4000-8000-000000000012';
    v_section uuid;
    v_group   uuid;
begin
    insert into public.tests (id, title, description, type)
    values (v_test, 'Reading Practice 1 — The Story of the Pencil',
            'Short practice passage: 13 questions, no time limit, answers shown after submitting.', 'reading');

    insert into public.test_versions (id, test_id, version_number)
    values (v_version, v_test, 1);
    perform pg_temp.add_mode(v_version, 'practice', true, null, null, 'immediately_in_practice', true);
    perform pg_temp.add_mode(v_version, 'mock', false, 1200, null, 'after_submit', false, 1);

    v_section := pg_temp.add_section(v_version, 1, 'Reading Passage',
        'Read the passage and answer **Questions 1–13**. There is no time limit.',
        $p$# The Story of the Pencil

**A** For a tool that most people take for granted, the pencil has a surprisingly long history. Its story begins in the sixteenth century, when a large deposit of unusually pure graphite was discovered in the north of England. Local shepherds soon found that the soft, dark material was ideal for marking their sheep, and before long it was being cut into sticks and sold to writers and artists.

**B** These early graphite sticks had an obvious drawback: they were brittle and left dark marks on the hands of anyone who used them. To solve this, users wrapped them in string or sheepskin. Later, craftsmen began to place the sticks inside hollowed-out pieces of wood, creating the basic design that is still used today.

**C** The pure graphite deposit was so valuable that it was guarded, and in some periods the mine was opened for only a few weeks each year. Other countries, without such a supply, had to find alternatives. The solution came in the 1790s, when a French engineer discovered that powdered graphite could be mixed with clay and then baked in a kiln. This invention had an important additional benefit: by changing the proportion of clay, manufacturers could make pencils that were harder or softer.

**D** Today, the hardness of a pencil is shown by a code printed on its side. Pencils marked with an 'H' contain more clay and produce lighter, finer lines, which makes them popular with engineers and architects. Pencils marked with a 'B' contain more graphite and produce darker lines that are easier to smudge, so they are often chosen by artists for shading. The common 'HB' pencil sits in the middle of the scale and is used for everyday writing.

**E** Although digital devices have replaced the pencil for many tasks, billions are still produced each year. Pencils work in extreme cold and even without gravity, which has made them useful to scientists, and their marks do not fade in sunlight in the way that some inks do. Perhaps most importantly, their marks can be erased — a feature that continues to make them the first choice for students sitting examinations.$p$);

    -- Questions 1–4: matching information
    v_group := pg_temp.add_group(v_section, 1, $i$**Questions 1–4**

The passage has five paragraphs, **A–E**.

Which paragraph contains the following information?

**NB** You may use any letter more than once.$i$,
        null,
        $j$[{"key":"A","text":"Paragraph A"},{"key":"B","text":"Paragraph B"},{"key":"C","text":"Paragraph C"},
            {"key":"D","text":"Paragraph D"},{"key":"E","text":"Paragraph E"}]$j$::jsonb,
        '{"allow_option_reuse": true}');
    perform pg_temp.add_question(v_group, 1, 'matching_information', 'choice',
        'the reason why pencils of different hardness could be made',
        '{"choice":"C"}', 'Paragraph C: "by changing the proportion of clay, manufacturers could make pencils that were harder or softer".');
    perform pg_temp.add_question(v_group, 2, 'matching_information', 'choice',
        'an early method of protecting the user''s hands',
        '{"choice":"B"}', 'Paragraph B: "users wrapped them in string or sheepskin".');
    perform pg_temp.add_question(v_group, 3, 'matching_information', 'choice',
        'the professions that prefer a particular type of pencil',
        '{"choice":"D"}', 'Paragraph D: H pencils are "popular with engineers and architects"; B pencils are chosen "by artists".');
    perform pg_temp.add_question(v_group, 4, 'matching_information', 'choice',
        'the first use of the graphite that was discovered',
        '{"choice":"A"}', 'Paragraph A: shepherds used it "for marking their sheep".');

    -- Questions 5–9: TRUE / FALSE / NOT GIVEN
    v_group := pg_temp.add_group(v_section, 2, $i$**Questions 5–9**

Do the following statements agree with the information given in the passage?

Write

**TRUE** if the statement agrees with the information
**FALSE** if the statement contradicts the information
**NOT GIVEN** if there is no information on this$i$);
    perform pg_temp.add_question(v_group, 1, 'true_false_not_given', 'choice',
        'The graphite found in England was first used by writers.',
        '{"choice":"FALSE"}', 'Paragraph A: shepherds used it first; only later was it "sold to writers and artists".');
    perform pg_temp.add_question(v_group, 2, 'true_false_not_given', 'choice',
        'Early graphite sticks broke easily.',
        '{"choice":"TRUE"}', 'Paragraph B: they "were brittle".');
    perform pg_temp.add_question(v_group, 3, 'true_false_not_given', 'choice',
        'The English graphite mine was sometimes open for only part of the year.',
        '{"choice":"TRUE"}', 'Paragraph C: "in some periods the mine was opened for only a few weeks each year".');
    perform pg_temp.add_question(v_group, 4, 'true_false_not_given', 'choice',
        'The French engineer was asked by his government to find a replacement for pure graphite.',
        '{"choice":"NOT_GIVEN"}', 'Paragraph C mentions the engineer''s discovery but not who asked him to work on it.');
    perform pg_temp.add_question(v_group, 5, 'true_false_not_given', 'choice',
        'Pencil marks fade when they are exposed to sunlight.',
        '{"choice":"FALSE"}', 'Paragraph E: "their marks do not fade in sunlight".');

    -- Questions 10–13: table completion
    v_group := pg_temp.add_group(v_section, 3, $i$**Questions 10–13**

Complete the table below.

Choose **NO MORE THAN TWO WORDS** from the passage for each answer.$i$,
        $c$| Pencil | Contains more | Lines | Often used by / for |
|---|---|---|---|
| H | {{gap:10}} | lighter, finer | engineers and architects |
| B | graphite | darker, easier to {{gap:11}} | {{gap:12}} |
| HB | (middle of the scale) | — | everyday {{gap:13}} |$c$,
        null, '{"max_words": 2}');
    perform pg_temp.add_question(v_group, 1, 'table_completion', 'text',
        'H pencils contain more ______',
        '{"accepted":["clay"]}', 'Paragraph D: "Pencils marked with an ''H'' contain more clay".');
    perform pg_temp.add_question(v_group, 2, 'table_completion', 'text',
        'B pencils: darker lines, easier to ______',
        '{"accepted":["smudge"]}', 'Paragraph D: "darker lines that are easier to smudge".');
    perform pg_temp.add_question(v_group, 3, 'table_completion', 'text',
        'B pencils are often used by ______',
        '{"accepted":["artists"]}', 'Paragraph D: B pencils "are often chosen by artists for shading".');
    perform pg_temp.add_question(v_group, 4, 'table_completion', 'text',
        'HB pencils: used for everyday ______',
        '{"accepted":["writing"]}', 'Paragraph D: "The common ''HB'' pencil … is used for everyday writing."');

    update public.test_versions set status = 'published', published_at = now() where id = v_version;
end
$seed$;
