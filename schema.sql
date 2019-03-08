CREATE TABLE todo (
    id serial primary key,
    title varchar(128),
    due timestamp with time zone default current_timestamp,
    position int default 0, 
    completed boolean default false,
    created timestamp with time zone not null default current_timestamp,
    updated timestamp with time zone not null default current_timestamp
);