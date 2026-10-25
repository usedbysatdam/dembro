(function () {
  const cfg = window.EDUCRAZY_CONFIG || {};
  const configured =
    typeof cfg.SUPABASE_URL === "string" &&
    cfg.SUPABASE_URL.startsWith("https://") &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
    typeof cfg.SUPABASE_ANON_KEY === "string" &&
    cfg.SUPABASE_ANON_KEY.length > 40;

  const client =
    configured && window.supabase
      ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
      : null;

  const DEMO_USER_KEY = "educrazy_demo_user";
  const DEMO_SAVED_KEY = "educrazy_demo_saved";
  const DEMO_DONE_KEY = "educrazy_demo_done";
  const DEMO_COMMUNITY_KEY = "educrazy_demo_community_v2";
  const DEFAULT_COLLECTION = "My Collection";

  const listeners = new Set();

  const demoUser = () => {
    try {
      return JSON.parse(localStorage.getItem(DEMO_USER_KEY) || "null");
    } catch (error) {
      return null;
    }
  };

  const setDemoUser = (user) => {
    if (user) localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(DEMO_USER_KEY);
  };

  const readList = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (error) {
      return [];
    }
  };

  const emit = () => listeners.forEach((fn) => fn());

  async function getUser() {
    if (!client) return demoUser();
    const { data } = await client.auth.getSession();
    const session = data.session;
    if (!session) return null;
    const { data: profile } = await client
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    return {
      id: session.user.id,
      email: session.user.email,
      name: (profile && profile.full_name) || session.user.email.split("@")[0],
      role: (profile && profile.role) || "parent",
      grade: (profile && profile.grade_focus) || "",
      plan: (profile && profile.plan) || "free",
      renews: profile && profile.plan_renews_at
    };
  }

  function onChange(fn) {
    listeners.add(fn);
    if (client) {
      client.auth.onAuthStateChange(() => fn());
    }
    return () => listeners.delete(fn);
  }

  async function signUp({ name, email, password, role, grade }) {
    if (!client) {
      setDemoUser({
        id: "demo-user",
        name: name || email.split("@")[0],
        email,
        role: role || "parent",
        grade: grade || "",
        plan: "free"
      });
      emit();
      return { error: null };
    }
    const { error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, role: role || "parent", grade_focus: grade || "" }
      }
    });
    return { error };
  }

  async function signIn({ email, password }) {
    if (!client) {
      const existing = demoUser();
      if (existing && existing.email === email) {
        emit();
        return { error: null };
      }
      setDemoUser({
        id: "demo-user",
        name: existing ? existing.name : email.split("@")[0],
        email,
        role: existing ? existing.role : "parent",
        grade: existing ? existing.grade : "",
        plan: existing ? existing.plan : "free"
      });
      emit();
      return { error: null };
    }
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    if (!client) {
      setDemoUser(null);
      emit();
      return;
    }
    await client.auth.signOut();
    emit();
  }

  async function setPlan(plan) {
    if (!client) {
      const user = demoUser();
      if (!user) return { error: new Error("Not signed in") };
      user.plan = plan;
      setDemoUser(user);
      emit();
      return { error: null };
    }
    const { error } = await client.rpc("set_plan", { new_plan: plan });
    emit();
    return { error };
  }

  async function getDefaultCollectionId() {
    const user = await getUser();
    if (!user) return null;
    const findExisting = async () => {
      const { data } = await client
        .from("collections")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", DEFAULT_COLLECTION)
        .order("created_at", { ascending: true })
        .limit(1);
      return data && data[0] ? data[0].id : null;
    };
    const existingId = await findExisting();
    if (existingId) return existingId;
    const { data: created, error } = await client
      .from("collections")
      .insert({ user_id: user.id, name: DEFAULT_COLLECTION })
      .select("id")
      .single();
    if (created) return created.id;
    // A parallel save may have created it first (unique user_id+name); reuse that row.
    return error ? findExisting() : null;
  }

  async function getSavedIds() {
    if (!client) return readList(DEMO_SAVED_KEY);
    const user = await getUser();
    if (!user) return [];
    const { data } = await client
      .from("collection_items")
      .select("resource_id, collections!inner(user_id)")
      .eq("collections.user_id", user.id);
    return (data || []).map((row) => Number(row.resource_id));
  }

  async function saveResource(resourceId) {
    const id = Number(resourceId);
    if (!client) {
      const ids = readList(DEMO_SAVED_KEY);
      if (!ids.includes(id)) ids.push(id);
      localStorage.setItem(DEMO_SAVED_KEY, JSON.stringify(ids));
      return { error: null };
    }
    const collectionId = await getDefaultCollectionId();
    if (!collectionId) return { error: new Error("Collection unavailable") };
    const { error } = await client
      .from("collection_items")
      .upsert(
        { collection_id: collectionId, resource_id: id },
        { onConflict: "collection_id,resource_id" }
      );
    return { error };
  }

  async function unsaveResource(resourceId) {
    const id = Number(resourceId);
    if (!client) {
      const ids = readList(DEMO_SAVED_KEY).filter((item) => item !== id);
      localStorage.setItem(DEMO_SAVED_KEY, JSON.stringify(ids));
      return { error: null };
    }
    const user = await getUser();
    if (!user) return { error: new Error("Not signed in") };
    const { data: collections } = await client
      .from("collections")
      .select("id")
      .eq("user_id", user.id);
    const collectionIds = (collections || []).map((row) => row.id);
    if (!collectionIds.length) return { error: null };
    const { error } = await client
      .from("collection_items")
      .delete()
      .eq("resource_id", id)
      .in("collection_id", collectionIds);
    return { error };
  }

  async function getDoneIds() {
    if (!client) return readList(DEMO_DONE_KEY);
    const user = await getUser();
    if (!user) return [];
    const { data } = await client
      .from("progress")
      .select("resource_id")
      .eq("user_id", user.id)
      .eq("status", "completed");
    return (data || []).map((row) => Number(row.resource_id));
  }

  async function markComplete(resourceId) {
    const id = Number(resourceId);
    if (!client) {
      const ids = readList(DEMO_DONE_KEY);
      if (!ids.includes(id)) ids.push(id);
      localStorage.setItem(DEMO_DONE_KEY, JSON.stringify(ids));
      return { error: null };
    }
    const user = await getUser();
    if (!user) return { error: new Error("Not signed in") };
    const { error } = await client
      .from("progress")
      .upsert(
        { user_id: user.id, resource_id: id, status: "completed", updated_at: new Date().toISOString() },
        { onConflict: "user_id,resource_id" }
      );
    return { error };
  }

  // ==================== Community (open sharing feed) ====================
  // Shape returned to the UI is identical in both modes so the feed code
  // never branches on demo vs Supabase:
  //   { id, authorId, authorName, authorHandle, authorInitials, authorAvatarColor,
  //     authorRole, content, topic, imageKey, createdAt, likes, reposts,
  //     liked, reposted, following, isMine, replies: [...] }
  const COMMUNITY_TOPICS = ["Umum", "Curhat", "Tanya", "Tips", "Pencapaian", "Rekomendasi"];
  const AVATAR_COLORS = ["#0249e1", "#ee3d5a", "#02308f", "#2e6be8", "#80b0ec", "#111111"];

  let communitySeed = [];
  let communitySeedShift = 0;

  function setCommunitySeed(posts) {
    communitySeed = Array.isArray(posts) ? posts : [];
    // Seed posts carry fixed dates, so their relative times would drift (or sit
    // in the future) as the calendar moves. Anchor the newest seed post to now
    // and shift the rest by the same amount to keep plausible "2j / 1h" labels.
    const newest = communitySeed.reduce((max, post) => {
      const time = new Date(`${post.date}T${post.time || "00:00"}:00`).getTime();
      return Number.isNaN(time) ? max : Math.max(max, time);
    }, 0);
    communitySeedShift = newest ? Date.now() - newest - 42 * 60 * 1000 : 0;
  }

  const shiftSeedTime = (date, time) => {
    const base = new Date(`${date}T${time || "00:00"}:00`).getTime();
    if (Number.isNaN(base)) return new Date().toISOString();
    return new Date(base + communitySeedShift).toISOString();
  };

  const readCommunityDemo = () => {
    try {
      const state = JSON.parse(localStorage.getItem(DEMO_COMMUNITY_KEY) || "{}");
      return state && typeof state === "object" ? state : {};
    } catch (error) {
      return {};
    }
  };

  const writeCommunityDemo = (state) => {
    localStorage.setItem(DEMO_COMMUNITY_KEY, JSON.stringify(state));
  };

  const initialsOf = (name) =>
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter((part) => /[a-zA-Z0-9]/.test(part[0] || ""))
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "EC";

  const handleOf = (name, fallback) =>
    String(name || fallback || "member")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 18) || "member";

  const colorFor = (key) => {
    const text = String(key || "");
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 9973;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  };

  const normaliseTopic = (topic) =>
    COMMUNITY_TOPICS.includes(topic) ? topic : "Umum";

  // Seed posts ship as display-ready JSON; map them onto the live shape.
  function seedToFeed(post, state, me) {
    const key = post.id;
    const local = state[key] || {};
    const seedReply = (reply, index, parentKey) => {
      const replyKey = `${parentKey}:${index}`;
      const localReply = state[replyKey] || {};
      return {
        id: replyKey,
        authorId: reply.handle || reply.user,
        authorName: reply.user,
        authorHandle: reply.handle || handleOf(reply.user),
        authorInitials: initialsOf(reply.user),
        authorAvatarColor: colorFor(reply.handle || reply.user),
        authorRole: reply.role === "edumate" ? "edumate" : "member",
        content: reply.text,
        topic: null,
        imageKey: null,
        createdAt: shiftSeedTime(post.date, reply.time || post.time),
        likes: (reply.likes || 0) + (localReply.liked ? 1 : 0),
        reposts: 0,
        liked: Boolean(localReply.liked),
        reposted: false,
        following: false,
        isMine: false,
        isSeed: true,
        // Replies the user wrote against a seed comment live under that
        // comment's key, so merge them back in on read.
        replies: (reply.replies || [])
          .map((child, i) => seedReply(child, i, replyKey))
          .concat((localReply.replies || []).map((own) => localReplyToFeed(own, state, me)))
      };
    };

    return {
      id: key,
      authorId: post.authorId || post.authorHandle,
      authorName: post.authorName,
      authorHandle: post.authorHandle || handleOf(post.authorName),
      authorInitials: post.authorInitials || initialsOf(post.authorName),
      authorAvatarColor: post.authorAvatarColor || colorFor(post.authorName),
      authorRole: post.authorRole === "edumate" ? "edumate" : "member",
      content: post.content,
      topic: normaliseTopic(post.topic || post.category),
      imageKey: post.imageKey || null,
      createdAt: shiftSeedTime(post.date, post.time),
      likes: (post.likes || 0) + (local.liked ? 1 : 0),
      reposts: (post.reposts || 0) + (local.reposted ? 1 : 0),
      liked: Boolean(local.liked),
      reposted: Boolean(local.reposted),
      // Same key the UI sends to toggleFollow (data-author = authorId).
      following: Boolean((state.following || {})[post.authorId || post.authorHandle]),
      isMine: false,
      isSeed: true,
      replies: (post.comments || [])
        .map((reply, i) => seedReply(reply, i, key))
        .concat((local.replies || []).map((reply) => localReplyToFeed(reply, state, me)))
    };
  }

  function localReplyToFeed(post, state, me) {
    const local = state[post.id] || {};
    return {
      id: post.id,
      authorId: post.authorId,
      authorName: post.authorName,
      authorHandle: post.authorHandle,
      authorInitials: post.authorInitials,
      authorAvatarColor: post.authorAvatarColor,
      authorRole: post.authorRole || "member",
      content: post.content,
      topic: post.topic ? normaliseTopic(post.topic) : null,
      imageKey: post.imageKey || null,
      createdAt: post.createdAt,
      likes: local.liked ? 1 : 0,
      reposts: local.reposted ? 1 : 0,
      liked: Boolean(local.liked),
      reposted: Boolean(local.reposted),
      following: false,
      isMine: Boolean(me && post.authorId === me.id),
      isSeed: false,
      replies: (local.replies || []).map((child) => localReplyToFeed(child, state, me))
    };
  }

  async function getCommunityFeed() {
    const me = await getUser();

    if (!client) {
      const state = readCommunityDemo();
      const own = (state.posts || []).map((post) => localReplyToFeed(post, state, me));
      const seeded = communitySeed.map((post) => seedToFeed(post, state, me));
      return own
        .concat(seeded)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }

    const [postsRes, likesRes, repostsRes, followsRes] = await Promise.all([
      client
        .from("community_posts")
        .select("id, author_id, parent_id, content, topic, image_key, created_at")
        .order("created_at", { ascending: false })
        .limit(400),
      client.from("community_likes").select("post_id, user_id"),
      client.from("community_reposts").select("post_id, user_id"),
      me
        ? client.from("community_follows").select("followee_id").eq("follower_id", me.id)
        : Promise.resolve({ data: [] })
    ]);

    if (postsRes.error) throw postsRes.error;
    const rows = postsRes.data || [];

    const authorIds = Array.from(new Set(rows.map((row) => row.author_id)));
    let authors = {};
    if (authorIds.length) {
      const { data: authorRows } = await client
        .from("community_authors")
        .select("id, display_name, handle, role")
        .in("id", authorIds);
      (authorRows || []).forEach((row) => {
        authors[row.id] = row;
      });
    }

    const likeRows = likesRes.data || [];
    const repostRows = repostsRes.data || [];
    const followed = new Set(((followsRes && followsRes.data) || []).map((row) => row.followee_id));

    const likeCount = {};
    const likedByMe = new Set();
    likeRows.forEach((row) => {
      likeCount[row.post_id] = (likeCount[row.post_id] || 0) + 1;
      if (me && row.user_id === me.id) likedByMe.add(row.post_id);
    });

    const repostCount = {};
    const repostedByMe = new Set();
    repostRows.forEach((row) => {
      repostCount[row.post_id] = (repostCount[row.post_id] || 0) + 1;
      if (me && row.user_id === me.id) repostedByMe.add(row.post_id);
    });

    const nodes = {};
    rows.forEach((row) => {
      const author = authors[row.author_id] || {};
      const name = author.display_name || "Anggota Educrazy";
      nodes[row.id] = {
        id: row.id,
        parentId: row.parent_id,
        authorId: row.author_id,
        authorName: name,
        authorHandle: author.handle || handleOf(name),
        authorInitials: initialsOf(name),
        authorAvatarColor: colorFor(row.author_id),
        authorRole: author.role === "teacher" ? "edumate" : "member",
        content: row.content,
        topic: row.parent_id ? null : normaliseTopic(row.topic),
        imageKey: row.image_key || null,
        createdAt: row.created_at,
        likes: likeCount[row.id] || 0,
        reposts: repostCount[row.id] || 0,
        liked: likedByMe.has(row.id),
        reposted: repostedByMe.has(row.id),
        following: followed.has(row.author_id),
        isMine: Boolean(me && row.author_id === me.id),
        isSeed: false,
        replies: []
      };
    });

    const roots = [];
    rows.forEach((row) => {
      const node = nodes[row.id];
      const parent = row.parent_id ? nodes[row.parent_id] : null;
      if (parent) parent.replies.push(node);
      else roots.push(node);
    });
    Object.values(nodes).forEach((node) => {
      node.replies.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    });

    return roots;
  }

  async function createCommunityPost({ content, topic, imageKey, parentId }) {
    const text = String(content || "").trim();
    if (!text) return { error: new Error("Tulis sesuatu dulu.") };
    if (text.length > 500) return { error: new Error("Maksimal 500 karakter.") };

    const me = await getUser();
    if (!me) return { error: new Error("Masuk dulu untuk ikut berbagi.") };

    if (!client) {
      const state = readCommunityDemo();
      const name = me.name || me.email || "Kamu";
      const post = {
        id: "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        authorId: me.id,
        authorName: name,
        authorHandle: handleOf(name, me.email),
        authorInitials: initialsOf(name),
        authorAvatarColor: colorFor(me.id),
        authorRole: me.role === "teacher" ? "edumate" : "member",
        content: text,
        topic: parentId ? null : normaliseTopic(topic),
        imageKey: imageKey || null,
        createdAt: new Date().toISOString()
      };

      if (parentId) {
        const entry = state[parentId] || {};
        entry.replies = Array.isArray(entry.replies) ? entry.replies : [];
        entry.replies.push(post);
        state[parentId] = entry;
      } else {
        state.posts = Array.isArray(state.posts) ? state.posts : [];
        state.posts.unshift(post);
      }
      writeCommunityDemo(state);
      return { error: null, id: post.id };
    }

    const { data, error } = await client
      .from("community_posts")
      .insert({
        author_id: me.id,
        parent_id: parentId || null,
        content: text,
        topic: parentId ? "Umum" : normaliseTopic(topic),
        image_key: imageKey || null
      })
      .select("id")
      .single();
    return { error, id: data && data.id };
  }

  async function deleteCommunityPost(postId) {
    const me = await getUser();
    if (!me) return { error: new Error("Masuk dulu.") };

    if (!client) {
      const state = readCommunityDemo();
      const prune = (list) =>
        (list || []).filter((post) => post.id !== postId);
      state.posts = prune(state.posts);
      Object.keys(state).forEach((key) => {
        const entry = state[key];
        if (entry && Array.isArray(entry.replies)) entry.replies = prune(entry.replies);
      });
      delete state[postId];
      writeCommunityDemo(state);
      return { error: null };
    }

    const { error } = await client
      .from("community_posts")
      .delete()
      .eq("id", postId)
      .eq("author_id", me.id);
    return { error };
  }

  async function toggleCommunityReaction(table, postId, nextOn) {
    const me = await getUser();
    if (!me) return { error: new Error("Masuk dulu."), on: false };

    if (!client) {
      const state = readCommunityDemo();
      const entry = state[postId] || {};
      const field = table === "community_likes" ? "liked" : "reposted";
      entry[field] = typeof nextOn === "boolean" ? nextOn : !entry[field];
      state[postId] = entry;
      writeCommunityDemo(state);
      return { error: null, on: entry[field] };
    }

    const { data: existing } = await client
      .from(table)
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", me.id)
      .maybeSingle();

    const on = typeof nextOn === "boolean" ? nextOn : !existing;
    if (on === Boolean(existing)) return { error: null, on };

    if (on) {
      const { error } = await client.from(table).insert({ post_id: postId, user_id: me.id });
      return { error, on: !error };
    }
    const { error } = await client
      .from(table)
      .delete()
      .eq("post_id", postId)
      .eq("user_id", me.id);
    return { error, on: Boolean(error) };
  }

  const toggleCommunityLike = (postId, nextOn) =>
    toggleCommunityReaction("community_likes", postId, nextOn);

  const toggleCommunityRepost = (postId, nextOn) =>
    toggleCommunityReaction("community_reposts", postId, nextOn);

  async function toggleCommunityFollow(authorKey, nextOn) {
    const me = await getUser();
    if (!me) return { error: new Error("Masuk dulu."), on: false };

    if (!client) {
      const state = readCommunityDemo();
      state.following = state.following || {};
      const on = typeof nextOn === "boolean" ? nextOn : !state.following[authorKey];
      if (on) state.following[authorKey] = true;
      else delete state.following[authorKey];
      writeCommunityDemo(state);
      return { error: null, on };
    }

    if (authorKey === me.id) return { error: new Error("Tidak bisa mengikuti diri sendiri."), on: false };

    const { data: existing } = await client
      .from("community_follows")
      .select("followee_id")
      .eq("follower_id", me.id)
      .eq("followee_id", authorKey)
      .maybeSingle();

    const on = typeof nextOn === "boolean" ? nextOn : !existing;
    if (on === Boolean(existing)) return { error: null, on };

    if (on) {
      const { error } = await client
        .from("community_follows")
        .insert({ follower_id: me.id, followee_id: authorKey });
      return { error, on: !error };
    }
    const { error } = await client
      .from("community_follows")
      .delete()
      .eq("follower_id", me.id)
      .eq("followee_id", authorKey);
    return { error, on: Boolean(error) };
  }

  window.Educrazy = {
    cfg,
    client,
    isDemo: !client,
    getUser,
    onChange,
    signUp,
    signIn,
    signOut,
    setPlan,
    getSavedIds,
    saveResource,
    unsaveResource,
    getDoneIds,
    markComplete,
    community: {
      TOPICS: COMMUNITY_TOPICS,
      setSeed: setCommunitySeed,
      getFeed: getCommunityFeed,
      createPost: createCommunityPost,
      deletePost: deleteCommunityPost,
      toggleLike: toggleCommunityLike,
      toggleRepost: toggleCommunityRepost,
      toggleFollow: toggleCommunityFollow
    }
  };
})();
